import csv
import io
from datetime import date
from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Announcement, Attendance, Event, EventFeedback, Registration, User
from backend.routers.events import event_to_out
from backend.schemas import AnnouncementOut, DashboardOut, EventReportRow, ReportsOut
from backend.security import get_current_user

router = APIRouter(prefix="/api", tags=["reports"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardOut:
    total_events = db.scalar(select(func.count()).select_from(Event)) or 0
    total_registrations = db.scalar(
        select(func.count()).select_from(Registration).where(Registration.status == "confirmed")
    ) or 0
    total_present = db.scalar(
        select(func.count())
        .select_from(Attendance)
        .join(Registration, Attendance.registration_id == Registration.id)
        .where(Registration.status == "confirmed", Attendance.status == "present")
    ) or 0
    total_absent = db.scalar(
        select(func.count())
        .select_from(Attendance)
        .join(Registration, Attendance.registration_id == Registration.id)
        .where(Registration.status == "confirmed", Attendance.status == "absent")
    ) or 0

    upcoming_count = db.scalar(
        select(func.count())
        .select_from(Event)
        .where(Event.event_date >= date.today(), Event.status == "upcoming")
    ) or 0

    total_marked = total_present + total_absent
    att_rate = round((total_present / total_marked * 100), 1) if total_marked > 0 else 0.0

    my_regs = db.scalar(
        select(func.count())
        .select_from(Registration)
        .where(Registration.user_id == current_user.id, Registration.status == "confirmed")
    ) or 0

    recent = db.scalars(select(Event).order_by(Event.event_date.desc()).limit(6)).all()

    ann_items = db.scalars(select(Announcement).order_by(Announcement.created_at.desc()).limit(4)).all()
    ann_outs = []
    for a in ann_items:
        author = db.get(User, a.created_by)
        ann_outs.append(
            AnnouncementOut(
                id=a.id,
                title=a.title,
                content=a.content,
                category=a.category,
                event_id=a.event_id,
                created_by=a.created_by,
                author_name=author.name if author else "Administration",
                created_at=a.created_at,
            )
        )

    return DashboardOut(
        total_events=total_events,
        total_registrations=total_registrations,
        total_present=total_present,
        total_absent=total_absent,
        upcoming_events_count=upcoming_count,
        attendance_rate=att_rate,
        my_registrations_count=my_regs,
        recent_events=[event_to_out(db, event, current_user) for event in recent],
        announcements=ann_outs,
    )


@router.get("/reports", response_model=ReportsOut)
def reports(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ReportsOut:
    events = db.scalars(select(Event).order_by(Event.event_date.asc(), Event.name.asc())).all()
    rows: list[EventReportRow] = []
    total_registrations = 0
    total_present = 0
    total_absent = 0

    for event in events:
        regs = db.scalar(
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

        unmarked = max(0, regs - present - absent)
        att_pct = round((present / regs * 100), 1) if regs > 0 else 0.0

        avg_rating_val = db.scalar(
            select(func.avg(EventFeedback.rating)).where(EventFeedback.event_id == event.id)
        )
        avg_rating = round(float(avg_rating_val or 0.0), 1)

        total_registrations += regs
        total_present += present
        total_absent += absent

        rows.append(
            EventReportRow(
                event_id=event.id,
                event_name=event.name,
                event_date=event.event_date,
                category=event.category or "Technical",
                venue=event.venue or "Main Auditorium",
                capacity=event.max_capacity or 100,
                registrations=regs,
                present=present,
                absent=absent,
                unmarked=unmarked,
                attendance_percentage=att_pct,
                average_rating=avg_rating,
            )
        )

    tot_marked = total_present + total_absent
    overall_att = round((total_present / tot_marked * 100), 1) if tot_marked > 0 else 0.0

    return ReportsOut(
        total_events=len(events),
        total_registrations=total_registrations,
        total_present=total_present,
        total_absent=total_absent,
        overall_attendance_rate=overall_att,
        events=rows,
    )


@router.get("/reports/export")
def export_reports_csv(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rep = reports(db, _)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID",
        "Event Name",
        "Date",
        "Category",
        "Venue",
        "Max Capacity",
        "Registrations",
        "Present",
        "Absent",
        "Unmarked",
        "Attendance Rate (%)",
        "Avg Rating",
    ])
    for row in rep.events:
        writer.writerow([
            row.event_id,
            row.event_name,
            row.event_date.isoformat(),
            row.category,
            row.venue,
            row.capacity,
            row.registrations,
            row.present,
            row.absent,
            row.unmarked,
            row.attendance_percentage,
            row.average_rating,
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="college_events_summary_report.csv"'},
    )
