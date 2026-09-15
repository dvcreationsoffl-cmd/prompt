import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.models import Attendance, Event, Registration, User
from backend.schemas import AttendanceOut, AttendanceUpdate, BulkAttendanceUpdate
from backend.security import get_current_user

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def attendance_to_out(item: Registration) -> AttendanceOut:
    status = item.attendance.status if item.attendance else "unmarked"
    return AttendanceOut(
        registration_id=item.id,
        student_id=item.user_id,
        student_name=item.user.name,
        student_email=item.user.email,
        student_department=item.user.department or "General",
        student_roll=item.user.roll_number,
        event_id=item.event_id,
        event_name=item.event.name,
        event_date=item.event.event_date,
        attendance=status,
    )


@router.get("", response_model=list[AttendanceOut])
def list_attendance(
    q: str = Query(default="", max_length=120),
    event_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AttendanceOut]:
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
    if event_id is not None:
        stmt = stmt.where(Registration.event_id == event_id)

    items = db.scalars(stmt).unique().all()
    results = [attendance_to_out(item) for item in items]
    search = q.strip().lower()
    if search:
        results = [
            row
            for row in results
            if search in row.student_name.lower()
            or search in row.event_name.lower()
            or (row.student_roll and search in row.student_roll.lower())
            or (row.student_department and search in row.student_department.lower())
            or (row.student_email and search in row.student_email.lower())
        ]
    if status_filter and status_filter != "all":
        results = [row for row in results if row.attendance == status_filter]
    return results


@router.put("/{registration_id}", response_model=AttendanceOut)
def mark_attendance(
    registration_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceOut:
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

    # Authorization fix: only creator of event, faculty, or admin can mark attendance
    if item.event.created_by != current_user.id and current_user.role not in ("admin", "faculty"):
        raise HTTPException(
            status_code=403,
            detail="Only the event coordinator, faculty, or admin can mark attendance.",
        )

    if item.attendance is None:
        item.attendance = Attendance(
            registration_id=item.id,
            status=payload.status,
            marked_by=current_user.id,
        )
        db.add(item.attendance)
    else:
        item.attendance.status = payload.status
        item.attendance.marked_by = current_user.id

    db.commit()
    db.refresh(item)
    return attendance_to_out(item)


@router.post("/bulk", status_code=status.HTTP_200_OK)
def mark_bulk_attendance(
    payload: BulkAttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    updated_count = 0
    for reg_id in payload.registration_ids:
        item = db.scalar(
            select(Registration)
            .options(joinedload(Registration.event), joinedload(Registration.attendance))
            .where(Registration.id == reg_id)
        )
        if not item:
            continue
        if item.event.created_by != current_user.id and current_user.role not in ("admin", "faculty"):
            continue

        if item.attendance is None:
            item.attendance = Attendance(
                registration_id=item.id,
                status=payload.status,
                marked_by=current_user.id,
            )
            db.add(item.attendance)
        else:
            item.attendance.status = payload.status
            item.attendance.marked_by = current_user.id
        updated_count += 1

    db.commit()
    return {"updated": updated_count}


@router.get("/export/{event_id}")
def export_attendance_csv(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found.")

    if event.created_by != current_user.id and current_user.role not in ("admin", "faculty"):
        raise HTTPException(status_code=403, detail="Access denied.")

    items = db.scalars(
        select(Registration)
        .options(
            joinedload(Registration.user),
            joinedload(Registration.attendance),
        )
        .where(Registration.event_id == event_id, Registration.status == "confirmed")
        .order_by(Registration.created_at.asc())
    ).unique().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Registration ID",
        "Student Name",
        "Roll Number",
        "Department",
        "Email",
        "Event Name",
        "Event Date",
        "Attendance Status",
        "Registered At",
    ])

    for reg in items:
        att = reg.attendance.status if reg.attendance else "unmarked"
        writer.writerow([
            reg.id,
            reg.user.name,
            reg.user.roll_number or "N/A",
            reg.user.department or "General",
            reg.user.email,
            event.name,
            event.event_date.isoformat(),
            att.upper(),
            reg.created_at.strftime("%Y-%m-%d %H:%M"),
        ])

    csv_content = output.getvalue()
    filename = f"attendance_{event.name.replace(' ', '_').lower()}_{event.event_date}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
