import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB = BASE_DIR / "college_events.db"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB.as_posix()}")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def migrate_db(target_engine=None):
    """Safely apply schema migrations for existing SQLite tables."""
    eng = target_engine or engine
    Base.metadata.create_all(bind=eng)

    with eng.connect() as conn:
        inspector = inspect(eng)
        table_names = inspector.get_table_names()

        if "users" in table_names:
            user_cols = {c["name"] for c in inspector.get_columns("users")}
            if "role" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'student' NOT NULL"))
            if "department" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN department VARCHAR(100) DEFAULT 'General'"))
            if "roll_number" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN roll_number VARCHAR(50)"))

        if "events" in table_names:
            event_cols = {c["name"] for c in inspector.get_columns("events")}
            if "category" not in event_cols:
                conn.execute(text("ALTER TABLE events ADD COLUMN category VARCHAR(50) DEFAULT 'Technical' NOT NULL"))
            if "venue" not in event_cols:
                conn.execute(text("ALTER TABLE events ADD COLUMN venue VARCHAR(120) DEFAULT 'Main Auditorium' NOT NULL"))
            if "time_range" not in event_cols:
                conn.execute(text("ALTER TABLE events ADD COLUMN time_range VARCHAR(50) DEFAULT '10:00 AM - 01:00 PM' NOT NULL"))
            if "max_capacity" not in event_cols:
                conn.execute(text("ALTER TABLE events ADD COLUMN max_capacity INTEGER DEFAULT 100 NOT NULL"))
            if "status" not in event_cols:
                conn.execute(text("ALTER TABLE events ADD COLUMN status VARCHAR(20) DEFAULT 'upcoming' NOT NULL"))
            if "department" not in event_cols:
                conn.execute(text("ALTER TABLE events ADD COLUMN department VARCHAR(100) DEFAULT 'All Departments' NOT NULL"))

        if "registrations" in table_names:
            reg_cols = {c["name"] for c in inspector.get_columns("registrations")}
            if "status" not in reg_cols:
                conn.execute(text("ALTER TABLE registrations ADD COLUMN status VARCHAR(20) DEFAULT 'confirmed' NOT NULL"))

        if "attendance" in table_names:
            att_cols = {c["name"] for c in inspector.get_columns("attendance")}
            if "marked_by" not in att_cols:
                conn.execute(text("ALTER TABLE attendance ADD COLUMN marked_by INTEGER"))

        conn.commit()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
