from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Group, Membership
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserOut,
    MeResponse,
    MembershipOut,
)
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="El usuario ya existe")
    if db.query(User).filter(User.email == str(payload.email)).first():
        raise HTTPException(status_code=409, detail="El email ya está registrado")

    user = User(
        username=payload.username,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        age=payload.age,
        avatar_emoji=payload.avatar_emoji,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    # Accept either username or email (case-insensitive) — users routinely type
    # their email at the login box.
    ident = (payload.username or "").strip()
    user = (
        db.query(User)
        .filter(
            func.lower(User.username) == ident.lower(),
        )
        .first()
    )
    if user is None and "@" in ident:
        user = db.query(User).filter(func.lower(User.email) == ident.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña inválidos")
    return AuthResponse(token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Heartbeat: /auth/me is polled by the app, so use it to track presence.
    current_user.last_seen = datetime.now(timezone.utc)
    db.commit()
    memberships = []
    for m in current_user.memberships:
        g = m.group
        memberships.append(
            MembershipOut(
                group_id=g.id,
                group_name=g.name,
                invite_code=g.invite_code,
                status=m.status,
                role=m.role,
                is_creator=(g.creator_id == current_user.id),
            )
        )
    return MeResponse(user=UserOut.model_validate(current_user), memberships=memberships)
