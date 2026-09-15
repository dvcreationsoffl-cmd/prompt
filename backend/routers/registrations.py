import hashlib
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.models import Attendance, Event, Registration, User
from backend.schemas import CertificateOut, RegistrationCreate, RegistrationOut
from backend.security import get_current_user

router = APIRouter(prefix="/api/registrations", tags=["registrations"])


def registration_to_out(item: Registration) -> RegistrationOut:
    att_status = item.attendance.status if item.attendance else "unmarked"
    eligible = att_status == "present"
    return RegistrationOut(
        id=item.id,
        student_id=item.user_id,
        student_name=item.user.name,
        student_email=item.user.email,
        student_department=item.user.department or "General",
        student_roll=item.user.roll_number,
        event_id=item.event_id,
        event_name=item.event.name,
        event_date=item.event.event_date,
        event_venue=item.event.venue or "Main Auditorium",
        event_time=item.event.time_range or "10:00 AM - 01:00 PM",
        event_category=item.event.category or "Technical",
        status=item.status or "confirmed",
        attendance_status=att_status,
        certificate_eligible=eligible,
        created_at=item.created_at,
    )


@router.get("", response_model=list[RegistrationOut])
def list_registrations(
    q: str = Query(default="", max_length=120),
    event_id: int | None = None,
    mine: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RegistrationOut]:
    stmt = (
        select(Registration)
        .options(
            joinedload(Registration.user),
            joinedload(Registration.event),
            joinedload(Registration.attendance),
        )
        .where(Registration.status == "confirmed")
        .order_by(Registration.created_at.desc())
    )
    if mine:
        stmt = stmt.where(Registration.user_id == current_user.id)
    if event_id is not None:
        stmt = stmt.where(Registration.event_id == event_id)

    items = db.scalars(stmt).unique().all()
    results = [registration_to_out(item) for item in items]
    search = q.strip().lower()
    if search:
        results = [
            row
            for row in results
            if search in row.student_name.lower()
            or search in row.event_name.lower()
            or search in row.student_email.lower()
            or (row.student_roll and search in row.student_roll.lower())
            or (row.student_department and search in row.student_department.lower())
        ]
    return results


@router.get("/my", response_model=list[RegistrationOut])
def list_my_registrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RegistrationOut]:
    stmt = (
        select(Registration)
        .options(
            joinedload(Registration.user),
            joinedload(Registration.event),
            joinedload(Registration.attendance),
        )
        .where(Registration.user_id == current_user.id, Registration.status == "confirmed")
        .order_by(Registration.created_at.desc())
    )
    items = db.scalars(stmt).unique().all()
    return [registration_to_out(item) for item in items]


@router.post("", response_model=RegistrationOut, status_code=status.HTTP_201_CREATED)
def register_for_event(
    payload: RegistrationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RegistrationOut:
    event = db.get(Event, payload.event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found.")

    if event.status == "cancelled":
        raise HTTPException(status_code=400, detail="This event has been cancelled.")

    # Check capacity limit
    active_count = db.scalar(
        select(func.count())
        .select_from(Registration)
        .where(Registration.event_id == event.id, Registration.status == "confirmed")
    ) or 0

    if active_count >= (event.max_capacity or 100):
        raise HTTPException(status_code=400, detail="Event has reached maximum capacity.")

    existing = db.scalar(
        select(Registration).where(
            Registration.user_id == current_user.id,
            Registration.event_id == payload.event_id,
        )
    )
    if existing:
        if existing.status == "confirmed":
            raise HTTPException(status_code=400, detail="You are already registered for this event.")
        else:
            # Reactivate cancelled registration
            existing.status = "confirmed"
            db.commit()
            db.refresh(existing)
            item = db.scalar(
                select(Registration)
                .options(
                    joinedload(Registration.user),
                    joinedload(Registration.event),
                    joinedload(Registration.attendance),
                )
                .where(Registration.id == existing.id)
            )
            return registration_to_out(item)

    item = Registration(user_id=current_user.id, event_id=payload.event_id, status="confirmed")
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="You are already registered for this event.")
    db.refresh(item)
    item = db.scalar(
        select(Registration)
        .options(
            joinedload(Registration.user),
            joinedload(Registration.event),
            joinedload(Registration.attendance),
        )
        .where(Registration.id == item.id)
    )
    return registration_to_out(item)


@router.delete("/{registration_id}", status_code=status.HTTP_200_OK)
def cancel_registration(
    registration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    item = db.get(Registration, registration_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Registration not found.")

    if item.user_id != current_user.id and current_user.role not in ("admin", "faculty"):
        raise HTTPException(status_code=403, detail="You cannot cancel another student's registration.")

    item.status = "cancelled"
    db.commit()
    return {"status": "cancelled", "message": "Registration successfully cancelled."}


@router.get("/{registration_id}/certificate", response_model=CertificateOut)
def get_certificate(
    registration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CertificateOut:
    item = db.scalar(
        select(Registration)
        .options(
            joinedload(Registration.user),
            joinedload(Registration.event),
            joinedload(Registration.attendance),
        )
        .where(Registration.id == registration_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Registration not found.")

    if item.user_id != current_user.id and current_user.role not in ("admin", "faculty"):
        raise HTTPException(status_code=403, detail="Access denied.")

    if not item.attendance or item.attendance.status != "present":
        raise HTTPException(
            status_code=400,
            detail="Certificate is only available for participants verified as Present.",
        )

    seed = f"CEMS-{item.event_id}-{item.user_id}-{item.event.event_date}"
    verif_hash = hashlib.sha256(seed.encode()).hexdigest()[:10].upper()
    cert_id = f"CERT-{item.event_id:03d}-{item.user_id:04d}"

    return CertificateOut(
        certificate_id=cert_id,
        student_name=item.user.name,
        student_roll=item.user.roll_number or f"ROLL-{item.user.id:04d}",
        student_department=item.user.department or "General",
        event_name=item.event.name,
        event_date=item.event.event_date,
        event_category=item.event.category or "Technical",
        event_venue=item.event.venue or "Main Auditorium",
        issue_date=date.today(),
        verification_code=verif_hash,
    )
