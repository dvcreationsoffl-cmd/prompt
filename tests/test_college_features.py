from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db, migrate_db
from backend.main import app

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
migrate_db(engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def auth_user(email: str, name: str, role: str = "student", dept: str = "CSE", roll: str = "CS001"):
    res = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "Password123",
            "role": role,
            "department": dept,
            "roll_number": roll,
        },
    )
    if res.status_code == 201:
        token = res.json()["access_token"]
    else:
        login = client.post("/api/auth/login", json={"email": email, "password": "Password123"})
        token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_roles_and_profile():
    headers = auth_user("prof.sharma@college.edu", "Prof. Sharma", role="faculty", dept="ECE", roll=None)
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "faculty"
    assert me.json()["department"] == "ECE"

    updated = client.put(
        "/api/auth/profile",
        json={"department": "Electrical & Computer Eng", "name": "Prof. S. Sharma"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Prof. S. Sharma"
    assert updated.json()["department"] == "Electrical & Computer Eng"


def test_event_authorization_and_management():
    prof = auth_user("prof.kumar@college.edu", "Prof. Kumar", role="faculty")
    student = auth_user("anita@college.edu", "Anita Roy", role="student", roll="CS101")

    # Prof creates event
    created = client.post(
        "/api/events",
        json={
            "name": "AI Symposium 2026",
            "event_date": "2026-10-15",
            "category": "Technical",
            "venue": "Dr. Kalam Auditorium",
            "time_range": "09:30 AM - 04:30 PM",
            "max_capacity": 50,
            "description": "Keynotes and workshops on modern AI.",
        },
        headers=prof,
    )
    assert created.status_code == 201
    event_id = created.json()["id"]
    assert created.json()["venue"] == "Dr. Kalam Auditorium"
    assert created.json()["max_capacity"] == 50

    # Student cannot edit prof's event
    bad_edit = client.put(
        f"/api/events/{event_id}",
        json={"name": "Hacked Event", "event_date": "2026-10-15"},
        headers=student,
    )
    assert bad_edit.status_code == 403

    # Prof can edit their event
    good_edit = client.put(
        f"/api/events/{event_id}",
        json={
            "name": "AI & Robotics Symposium 2026",
            "event_date": "2026-10-15",
            "venue": "Main Auditorium",
        },
        headers=prof,
    )
    assert good_edit.status_code == 200
    assert good_edit.json()["name"] == "AI & Robotics Symposium 2026"


def test_capacity_limit_and_cancellation():
    prof = auth_user("organizer@college.edu", "Event Org", role="faculty")
    s1 = auth_user("student1@college.edu", "Student One", role="student", roll="CS001")
    s2 = auth_user("student2@college.edu", "Student Two", role="student", roll="CS002")

    # Create event with capacity = 1
    event_res = client.post(
        "/api/events",
        json={
            "name": "Exclusive Hackathon Workshop",
            "event_date": "2026-11-01",
            "max_capacity": 1,
            "venue": "Lab 4",
        },
        headers=prof,
    )
    event_id = event_res.json()["id"]

    # Student 1 registers successfully
    r1 = client.post("/api/registrations", json={"event_id": event_id}, headers=s1)
    assert r1.status_code == 201
    r1_id = r1.json()["id"]

    # Student 2 tries to register -> should fail because capacity is full
    r2 = client.post("/api/registrations", json={"event_id": event_id}, headers=s2)
    assert r2.status_code == 400
    assert "maximum capacity" in r2.json()["detail"].lower()

    # Student 1 cancels their registration
    cancelled = client.delete(f"/api/registrations/{r1_id}", headers=s1)
    assert cancelled.status_code == 200

    # Student 2 can now successfully register!
    r2_retry = client.post("/api/registrations", json={"event_id": event_id}, headers=s2)
    assert r2_retry.status_code == 201


def test_attendance_auth_and_certificates():
    prof = auth_user("chair@college.edu", "Department Chair", role="faculty")
    student = auth_user("rohit@college.edu", "Rohit Verma", role="student", roll="ME105")

    ev = client.post(
        "/api/events",
        json={"name": "Annual Mech Expo", "event_date": "2026-10-20", "venue": "Grounds"},
        headers=prof,
    )
    ev_id = ev.json()["id"]

    reg = client.post("/api/registrations", json={"event_id": ev_id}, headers=student)
    reg_id = reg.json()["id"]

    # Student cannot mark their own attendance
    student_mark = client.put(f"/api/attendance/{reg_id}", json={"status": "present"}, headers=student)
    assert student_mark.status_code == 403

    # Prof marks student present
    prof_mark = client.put(f"/api/attendance/{reg_id}", json={"status": "present"}, headers=prof)
    assert prof_mark.status_code == 200
    assert prof_mark.json()["attendance"] == "present"

    # Student can now generate their participation certificate
    cert = client.get(f"/api/registrations/{reg_id}/certificate", headers=student)
    assert cert.status_code == 200
    c_data = cert.json()
    assert c_data["student_name"] == "Rohit Verma"
    assert c_data["event_name"] == "Annual Mech Expo"
    assert "verification_code" in c_data

    # Test CSV export
    csv_rep = client.get(f"/api/attendance/export/{ev_id}", headers=prof)
    assert csv_rep.status_code == 200
    assert "Rohit Verma" in csv_rep.text
    assert "PRESENT" in csv_rep.text


def test_feedback_and_announcements():
    prof = auth_user("dean@college.edu", "Dean Academics", role="faculty")
    student = auth_user("kavita@college.edu", "Kavita Reddy", role="student", roll="EE202")

    ev = client.post(
        "/api/events",
        json={"name": "Energy Summit", "event_date": "2026-10-25"},
        headers=prof,
    )
    ev_id = ev.json()["id"]
    client.post("/api/registrations", json={"event_id": ev_id}, headers=student)

    # Student submits feedback
    fb = client.post(
        f"/api/events/{ev_id}/feedback",
        json={"rating": 5, "comment": "Outstanding session and speakers!"},
        headers=student,
    )
    assert fb.status_code == 201
    assert fb.json()["rating"] == 5

    # Prof posts campus announcement
    ann = client.post(
        "/api/announcements",
        json={"title": "Campus Notice: Hackathon Schedule", "content": "Venue shifted to Audi B.", "category": "Urgent"},
        headers=prof,
    )
    assert ann.status_code == 201

    # Student reads announcements
    ann_list = client.get("/api/announcements", headers=student)
    assert ann_list.status_code == 200
    assert any("Campus Notice" in a["title"] for a in ann_list.json())

    # Full report CSV export
    rep_csv = client.get("/api/reports/export", headers=prof)
    assert rep_csv.status_code == 200
    assert "Energy Summit" in rep_csv.text
