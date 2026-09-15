from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import TokenResponse, UserCreate, UserLogin, UserOut, UserProfileUpdate
from backend.security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    name = payload.name.strip()
    email = str(payload.email).lower()

    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role or "student",
        department=payload.department or "General",
        roll_number=payload.roll_number.strip() if payload.roll_number else None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id), user=user)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    email = str(payload.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return TokenResponse(access_token=create_access_token(user.id), user=user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    if payload.name is not None:
        current_user.name = payload.name.strip()
    if payload.department is not None:
        current_user.department = payload.department.strip()
    if payload.roll_number is not None:
        current_user.roll_number = payload.roll_number.strip() or None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users", response_model=list[UserOut])
def list_users(
    role: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserOut]:
    if current_user.role not in ("admin", "faculty"):
        raise HTTPException(status_code=403, detail="Access restricted to faculty and admins.")
    stmt = select(User).order_by(User.name.asc())
    if role:
        stmt = stmt.where(User.role == role)
    return list(db.scalars(stmt).all())
