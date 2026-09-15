from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: str = Field(default="student", pattern="^(student|faculty|admin)$")
    department: str | None = Field(default="General", max_length=100)
    roll_number: str | None = Field(default=None, max_length=50)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    roll_number: str | None = Field(default=None, max_length=50)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: str = "student"
    department: str | None = "General"
    roll_number: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class EventCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    event_date: date
    description: str | None = Field(default=None, max_length=1000)
    category: str = Field(default="Technical", max_length=50)
    venue: str = Field(default="Main Auditorium", max_length=120)
    time_range: str = Field(default="10:00 AM - 01:00 PM", max_length=50)
    max_capacity: int = Field(default=100, ge=1, le=5000)
    status: str = Field(default="upcoming", pattern="^(upcoming|completed|cancelled)$")
    department: str = Field(default="All Departments", max_length=100)


class EventUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    event_date: date
    description: str | None = Field(default=None, max_length=1000)
    category: str = Field(default="Technical", max_length=50)
    venue: str = Field(default="Main Auditorium", max_length=120)
    time_range: str = Field(default="10:00 AM - 01:00 PM", max_length=50)
    max_capacity: int = Field(default=100, ge=1, le=5000)
    status: str = Field(default="upcoming", pattern="^(upcoming|completed|cancelled)$")
    department: str = Field(default="All Departments", max_length=100)


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    event_date: date
    description: str | None
    category: str = "Technical"
    venue: str = "Main Auditorium"
    time_range: str = "10:00 AM - 01:00 PM"
    max_capacity: int = 100
    available_seats: int = 100
    status: str = "upcoming"
    department: str = "All Departments"
    created_by: int
    creator_name: str | None = None
    registrations: int = 0
    attendance_present: int = 0
    attendance_absent: int = 0
    average_rating: float = 0.0
    feedback_count: int = 0
    is_registered: bool = False
    my_attendance: str | None = None


class RegistrationCreate(BaseModel):
    event_id: int


class RegistrationOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    student_department: str | None = None
    student_roll: str | None = None
    event_id: int
    event_name: str
    event_date: date
    event_venue: str = "Main Auditorium"
    event_time: str = "10:00 AM - 01:00 PM"
    event_category: str = "Technical"
    status: str
    attendance_status: str = "unmarked"
    certificate_eligible: bool = False
    created_at: datetime


class AttendanceUpdate(BaseModel):
    status: str = Field(pattern="^(present|absent)$")


class BulkAttendanceUpdate(BaseModel):
    registration_ids: list[int]
    status: str = Field(pattern="^(present|absent)$")


class AttendanceOut(BaseModel):
    registration_id: int
    student_id: int
    student_name: str
    student_email: str | None = None
    student_department: str | None = None
    student_roll: str | None = None
    event_id: int
    event_name: str
    event_date: date
    attendance: str


class CertificateOut(BaseModel):
    certificate_id: str
    student_name: str
    student_roll: str | None
    student_department: str | None
    event_name: str
    event_date: date
    event_category: str
    event_venue: str
    issue_date: date
    verification_code: str


class EventFeedbackCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class EventFeedbackOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    user_name: str
    rating: int
    comment: str | None
    created_at: datetime


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    content: str = Field(min_length=5, max_length=2000)
    category: str = Field(default="General", max_length=50)
    event_id: int | None = None


class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    category: str
    event_id: int | None
    created_by: int
    author_name: str
    created_at: datetime


class DashboardOut(BaseModel):
    total_events: int
    total_registrations: int
    total_present: int
    total_absent: int
    upcoming_events_count: int = 0
    attendance_rate: float = 0.0
    my_registrations_count: int = 0
    recent_events: list[EventOut]
    announcements: list[AnnouncementOut] = []


class EventReportRow(BaseModel):
    event_id: int
    event_name: str
    event_date: date
    category: str = "Technical"
    venue: str = "Main Auditorium"
    capacity: int = 100
    registrations: int
    present: int
    absent: int
    unmarked: int
    attendance_percentage: float = 0.0
    average_rating: float = 0.0


class ReportsOut(BaseModel):
    total_events: int
    total_registrations: int
    total_present: int
    total_absent: int
    overall_attendance_rate: float = 0.0
    events: list[EventReportRow]
