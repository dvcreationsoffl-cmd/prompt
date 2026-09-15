from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.models import Event, EventFeedback, Registration, User
from backend.schemas import EventFeedbackCreate, EventFeedbackOut
from backend.security import get_current_user

router = APIRouter(prefix="/api/events", tags=["feedback"])


@router.get("/{event_id}/feedback", response_model=list[EventFeedbackOut])
def list_event_feedback(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[EventFeedbackOut]:
    feedbacks = db.scalars(
        select(EventFeedback)
        .options(joinedload(EventFeedback.user))
        .where(EventFeedback.event_id == event_id)
        .order_by(EventFeedback.created_at.desc())
    ).all()

    return [
        EventFeedbackOut(
            id=fb.id,
            event_id=fb.event_id,
            user_id=fb.user_id,
            user_name=fb.user.name,
            rating=fb.rating,
            comment=fb.comment,
            created_at=fb.created_at,
        )
        for fb in feedbacks
    ]


@router.post("/{event_id}/feedback", response_model=EventFeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    event_id: int,
    payload: EventFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventFeedbackOut:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found.")

    # Check if registered
    reg = db.scalar(
        select(Registration).where(
            Registration.event_id == event_id,
            Registration.user_id == current_user.id,
            Registration.status == "confirmed",
        )
    )
    if not reg and current_user.role not in ("admin", "faculty"):
        raise HTTPException(status_code=400, detail="You must be registered for this event to leave feedback.")

    existing = db.scalar(
        select(EventFeedback).where(
            EventFeedback.event_id == event_id,
            EventFeedback.user_id == current_user.id,
        )
    )
    if existing:
        existing.rating = payload.rating
        existing.comment = payload.comment.strip() if payload.comment else None
        db.commit()
        db.refresh(existing)
        return EventFeedbackOut(
            id=existing.id,
            event_id=existing.event_id,
            user_id=existing.user_id,
            user_name=current_user.name,
            rating=existing.rating,
            comment=existing.comment,
            created_at=existing.created_at,
        )

    fb = EventFeedback(
        event_id=event_id,
        user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment.strip() if payload.comment else None,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return EventFeedbackOut(
        id=fb.id,
        event_id=fb.event_id,
        user_id=fb.user_id,
        user_name=current_user.name,
        rating=fb.rating,
        comment=fb.comment,
        created_at=fb.created_at,
    )
