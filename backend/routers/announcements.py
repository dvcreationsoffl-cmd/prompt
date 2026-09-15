from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Announcement, User
from backend.schemas import AnnouncementCreate, AnnouncementOut
from backend.security import get_current_user

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


@router.get("", response_model=list[AnnouncementOut])
def list_announcements(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AnnouncementOut]:
    items = db.scalars(select(Announcement).order_by(Announcement.created_at.desc()).limit(20)).all()
    results = []
    for item in items:
        creator = db.get(User, item.created_by)
        results.append(
            AnnouncementOut(
                id=item.id,
                title=item.title,
                content=item.content,
                category=item.category,
                event_id=item.event_id,
                created_by=item.created_by,
                author_name=creator.name if creator else "College Administration",
                created_at=item.created_at,
            )
        )
    return results


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnnouncementOut:
    if current_user.role not in ("admin", "faculty"):
        raise HTTPException(status_code=403, detail="Only faculty and admins can post announcements.")

    item = Announcement(
        title=payload.title.strip(),
        content=payload.content.strip(),
        category=payload.category,
        event_id=payload.event_id,
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return AnnouncementOut(
        id=item.id,
        title=item.title,
        content=item.content,
        category=item.category,
        event_id=item.event_id,
        created_by=item.created_by,
        author_name=current_user.name,
        created_at=item.created_at,
    )


@router.delete("/{announcement_id}", status_code=status.HTTP_200_OK)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    item = db.get(Announcement, announcement_id)
    if not item:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    if item.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to delete this announcement.")

    db.delete(item)
    db.commit()
    return {"status": "deleted", "message": "Announcement deleted."}
