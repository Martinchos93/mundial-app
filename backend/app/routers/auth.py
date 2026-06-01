import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Group
from app.schemas.auth import JoinRequest, CreateGroupRequest, AuthResponse, UserOut
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

_ALPHABET = string.ascii_uppercase + string.digits


def _generate_invite_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if not db.query(Group).filter(Group.invite_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate invite code")


@router.post("/join", response_model=AuthResponse)
def join(payload: JoinRequest, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.invite_code == payload.invite_code.upper()).first()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")

    user = User(name=payload.name, avatar_emoji=payload.avatar_emoji, group_id=group.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        token=create_access_token(user.id),
        user=UserOut.model_validate(user),
        invite_code=group.invite_code,
    )


@router.post("/create-group", response_model=AuthResponse)
def create_group(payload: CreateGroupRequest, db: Session = Depends(get_db)):
    code = _generate_invite_code(db)
    group = Group(name=payload.group_name, invite_code=code)
    db.add(group)
    db.flush()

    user = User(name=payload.name, avatar_emoji=payload.avatar_emoji, group_id=group.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        token=create_access_token(user.id),
        user=UserOut.model_validate(user),
        invite_code=group.invite_code,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
