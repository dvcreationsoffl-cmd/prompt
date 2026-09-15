from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="student", nullable=False)  # student, faculty, admin
    department: Mapped[str | None] = mapped_column(String(100), nullable=True, default="General")
    roll_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    registrations: Mapped[list["Registration"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    feedbacks: Mapped[list["EventFeedback"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    created_events: Mapped[list["Event"]] = relationship(back_populates="creator", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="Technical", nullable=False)  # Technical, Cultural, Sports, Workshop, Seminar, etc.
    venue: Mapped[str] = mapped_column(String(120), default="Main Auditorium", nullable=False)
    time_range: Mapped[str] = mapped_column(String(50), default="10:00 AM - 01:00 PM", nullable=False)
    max_capacity: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="upcoming", nullable=False)  # upcoming, completed, cancelled
    department: Mapped[str] = mapped_column(String(100), default="All Departments", nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    creator: Mapped[User] = relationship(back_populates="created_events")
    registrations: Mapped[list["Registration"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    feedbacks: Mapped[list["EventFeedback"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_user_event"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="confirmed", nullable=False)  # confirmed, cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    user: Mapped[User] = relationship(back_populates="registrations")
    event: Mapped[Event] = relationship(back_populates="registrations")
    attendance: Mapped["Attendance | None"] = relationship(
        back_populates="registration", uselist=False, cascade="all, delete-orphan"
    )


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(primary_key=True)
    registration_id: Mapped[int] = mapped_column(
        ForeignKey("registrations.id"), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # present, absent
    marked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now
    )

    registration: Mapped[Registration] = relationship(back_populates="attendance")


class EventFeedback(Base):
    __tablename__ = "event_feedbacks"
    __table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_feedback_user_event"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 to 5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    user: Mapped[User] = relationship(back_populates="feedbacks")
    event: Mapped[Event] = relationship(back_populates="feedbacks")


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="General", nullable=False)  # Urgent, General, Event
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
