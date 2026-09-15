from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.models import Attendance, Event, EventFeedback, Registration, User
from backend.schemas import EventCreate, EventOut, EventUpdate
from backend.security import get_current_user

router = APIRouter(prefix="/api/events", tags=["events"])


def event_to_out(db: Session, event: Event, current_user: User | None = None) -> EventOut:
    registrations = db.scalar(
        select(func.count())
        .select_from(Registration)
        .where(Registration.event_id == event.id, Registration.status == "confirmed")
    ) or 0

    present = db.scalar(
        select(func.count())
        .select_from(Attendance)
        .join(Registration, Attendance.registration_id == Registration.id)
        .where(
            Registration.event_id == event.id,
            Registration.status == "confirmed",
            Attendance.status == "present",
        )
    ) or 0

    absent = db.scalar(
        select(func.count())
        .select_from(Attendance)
        .join(Registration, Attendance.registration_id == Registration.id)
        .where(
            Registration.event_id == event.id,
            Registration.status == "confirmed",
            Attendance.status == "absent",
        )
    ) or 0

    rating_data = db.execute(
        select(func.avg(EventFeedback.rating), func.count(EventFeedback.id))
        .where(EventFeedback.event_id == event.id)
    ).first()

    avg_rating = round(float(rating_data[0] or 0.0), 1) if rating_data else 0.0
    fb_count = int(rating_data[1] or 0) if rating_data else 0

    creator = db.get(User, event.created_by)
    creator_name = creator.name if creator else "College Organizer"

    is_registered = False
    my_att = None
    if current_user:
        my_reg = db.scalar(
            select(Registration)
            .options(joinedload(Registration.attendance))
            .where(
                Registration.event_id == event.id,
                Registration.user_id == current_user.id,
                Registration.status == "confirmed",
            )
        )
        if my_reg:
            is_registered = True
            if my_reg.attendance:
                my_att = my_reg.attendance.status

    capacity = event.max_capacity or 100
    available = max(0, capacity - registrations)

    return EventOut(
        id=event.id,
        name=event.name,
        event_date=event.event_date,
        description=event.description,
        category=event.category or "Technical",
        venue=event.venue or "Main Auditorium",
        time_range=event.time_range or "10:00 AM - 01:00 PM",
        max_capacity=capacity,
        available_seats=available,
        status=event.status or "upcoming",
        department=event.department or "All Departments",
        created_by=event.created_by,
        creator_name=creator_name,
        registrations=registrations,
        attendance_present=present,
        attendance_absent=absent,
        average_rating=avg_rating,
        feedback_count=fb_count,
        is_registered=is_registered,
        my_attendance=my_att,
    )


@router.get("", response_model=list[EventOut])
def list_events(
    q: str = Query(default="", max_length=120),
    category: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    department: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EventOut]:
    stmt = select(Event).order_by(Event.event_date.asc(), Event.name.asc())
    search = q.strip()
    if search:
        stmt = stmt.where(Event.name.ilike(f"%{search}%") | Event.description.ilike(f"%{search}%") | Event.venue.ilike(f"%{search}%"))
    if category and category != "All":
        stmt = stmt.where(Event.category == category)
    if status_filter and status_filter != "all":
        stmt = stmt.where(Event.status == status_filter)
    if department and department != "All Departments":
        stmt = stmt.where((Event.department == department) | (Event.department == "All Departments"))

    events = db.scalars(stmt).all()
    return [event_to_out(db, event, current_user) for event in events]


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventOut:
    event = Event(
        name=payload.name.strip(),
        event_date=payload.event_date,
        description=(payload.description or "").strip() or None,
        category=payload.category,
        venue=payload.venue.strip(),
        time_range=payload.time_range.strip(),
        max_capacity=payload.max_capacity,
        status=payload.status,
        department=payload.department.strip(),
        created_by=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event_to_out(db, event, current_user)


@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventOut:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found.")
    return event_to_out(db, event, current_user)


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventOut:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found.")

    # Authorization check: only creator, faculty, or admin can update event
    if event.created_by != current_user.id and current_user.role not in ("admin", "faculty"):
        raise HTTPException(status_code=403, detail="You do not have permission to edit this event.")

    event.name = payload.name.strip()
    event.event_date = payload.event_date
    event.description = (payload.description or "").strip() or None
    event.category = payload.category
    event.venue = payload.venue.strip()
    event.time_range = payload.time_range.strip()
    event.max_capacity = payload.max_capacity
    event.status = payload.status
    event.department = payload.department.strip()

    db.commit()
    db.refresh(event)
    return event_to_out(db, event, current_user)


@router.delete("/{event_id}", status_code=status.HTTP_200_OK)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found.")

    if event.created_by != current_user.id and current_user.role not in ("admin", "faculty"):
        raise HTTPException(status_code=403, detail="You do not have permission to delete this event.")

    db.delete(event)
    db.commit()
    return {"status": "deleted", "message": f"Event '{event.name}' has been deleted."}
