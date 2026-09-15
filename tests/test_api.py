from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def auth_headers(email: str = "student@college.edu", password: str = "password1", name: str = "Aarav Kumar"):
    register = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    if register.status_code == 201:
        token = register.json()["access_token"]
    else:
        login = client.post("/api/auth/login", json={"email": email, "password": password})
        token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_frontend_is_served():
    response = client.get("/")
    assert response.status_code == 200
    assert "College Event Management System" in response.text
    assert client.get("/style.css").status_code == 200
    assert client.get("/script.js").status_code == 200


def test_register_login_and_validation():
    short = client.post(
        "/api/auth/register",
        json={"name": "A", "email": "bad", "password": "short"},
    )
    assert short.status_code == 422

    created = client.post(
        "/api/auth/register",
        json={"name": "Priya Sharma", "email": "priya@college.edu", "password": "password1"},
    )
    assert created.status_code == 201
    assert "access_token" in created.json()
    assert created.json()["user"]["email"] == "priya@college.edu"

    duplicate = client.post(
        "/api/auth/register",
        json={"name": "Priya Sharma", "email": "priya@college.edu", "password": "password1"},
    )
    assert duplicate.status_code == 400

    bad_login = client.post(
        "/api/auth/login",
        json={"email": "priya@college.edu", "password": "wrongpass"},
    )
    assert bad_login.status_code == 401

    login = client.post(
        "/api/auth/login",
        json={"email": "priya@college.edu", "password": "password1"},
    )
    assert login.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.status_code == 200
    assert me.json()["name"] == "Priya Sharma"


def test_events_search_register_attendance_reports():
    headers = auth_headers()
    other = auth_headers("rahul@college.edu", "password1", "Rahul Das")

    unauthorized = client.get("/api/events")
    assert unauthorized.status_code == 401

    created = client.post(
        "/api/events",
        json={"name": "Technical Workshop", "event_date": "2026-09-15", "description": "Hands-on lab"},
        headers=headers,
    )
    assert created.status_code == 201
    event_id = created.json()["id"]

    client.post(
        "/api/events",
        json={"name": "Sports Meet", "event_date": "2026-09-20"},
        headers=headers,
    )

    listed = client.get("/api/events", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) >= 2

    search = client.get("/api/events", params={"q": "workshop"}, headers=headers)
    assert search.status_code == 200
    assert len(search.json()) == 1
    assert search.json()[0]["name"] == "Technical Workshop"

    updated = client.put(
        f"/api/events/{event_id}",
        json={"name": "Technical Workshop", "event_date": "2026-09-16", "description": "Updated lab"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["event_date"] == "2026-09-16"

    first_reg = client.post("/api/registrations", json={"event_id": event_id}, headers=headers)
    assert first_reg.status_code == 201
    second_reg = client.post("/api/registrations", json={"event_id": event_id}, headers=headers)
    assert second_reg.status_code == 400

    other_reg = client.post("/api/registrations", json={"event_id": event_id}, headers=other)
    assert other_reg.status_code == 201
    other_reg_id = other_reg.json()["id"]

    regs = client.get("/api/registrations", params={"q": "Rahul"}, headers=headers)
    assert len(regs.json()) == 1

    marked = client.put(
        f"/api/attendance/{other_reg_id}",
        json={"status": "present"},
        headers=headers,
    )
    assert marked.status_code == 200
    assert marked.json()["attendance"] == "present"

    attendance = client.get("/api/attendance", params={"event_id": event_id}, headers=headers)
    assert attendance.status_code == 200
    assert len(attendance.json()) == 2

    dashboard = client.get("/api/dashboard", headers=headers)
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["total_events"] >= 2
    assert body["total_registrations"] >= 2
    assert body["total_present"] >= 1

    reports = client.get("/api/reports", headers=headers)
    assert reports.status_code == 200
    workshop = next(row for row in reports.json()["events"] if row["event_id"] == event_id)
    assert workshop["registrations"] == 2
    assert workshop["present"] == 1
