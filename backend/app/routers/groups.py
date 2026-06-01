import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Group, Column, User, Membership
from app.models.column import DEFAULT_SCORING_CONFIG
from app.schemas.group import GroupOut, MemberOut
from app.schemas.column import ColumnOut

router = APIRouter(prefix="/groups", tags=["groups"])

_ALPHABET = string.ascii_uppercase + string.digits


class CreateProdeRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


def _generate_invite_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if not db.query(Group).filter(Group.invite_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate invite code")


def _membership(db: Session, user_id: int, group_id: int) -> Membership | None:
    return (
        db.query(Membership)
        .filter(Membership.user_id == user_id, Membership.group_id == group_id)
        .one_or_none()
    )


@router.post("", response_model=GroupOut, status_code=201)
def create_prode(
    payload: CreateProdeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = Group(name=payload.name, invite_code=_generate_invite_code(db), creator_id=current_user.id)
    db.add(group)
    db.flush()
    db.add(Membership(user_id=current_user.id, group_id=group.id, status="active", role="creator"))
    db.add(
        Column(
            name="General",
            status="active",
            group_ids=[group.id],
            match_ids=[],
            scoring_config=dict(DEFAULT_SCORING_CONFIG),
        )
    )
    db.commit()
    db.refresh(group)
    return GroupOut.model_validate(group)


@router.post("/{code}/join")
def join_prode(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(Group).filter(Group.invite_code == code.upper()).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Código de prode inválido")
    existing = _membership(db, current_user.id, group.id)
    if existing:
        return {"group_id": group.id, "status": existing.status}
    m = Membership(user_id=current_user.id, group_id=group.id, status="pending", role="member")
    db.add(m)
    db.commit()
    return {"group_id": group.id, "status": "pending"}


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return GroupOut.model_validate(group)


@router.get("/{group_id}/columns", response_model=list[ColumnOut])
def get_group_columns(group_id: int, db: Session = Depends(get_db)):
    columns = (
        db.query(Column)
        .filter(Column.group_ids.any(group_id))
        .order_by(Column.created_at.desc())
        .all()
    )
    return [ColumnOut.model_validate(c) for c in columns]


def _member_out(m: Membership, group: Group) -> MemberOut:
    u = m.user
    return MemberOut(
        user_id=u.id,
        name=u.display_name,
        avatar_emoji=u.avatar_emoji,
        status=m.status,
        is_creator=(m.role == "creator" or group.creator_id == u.id),
    )


@router.get("/{group_id}/members", response_model=list[MemberOut])
def list_members(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if _membership(db, current_user.id, group_id) is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")
    members = (
        db.query(Membership)
        .filter(Membership.group_id == group_id)
        .order_by(Membership.created_at.asc())
        .all()
    )
    return [_member_out(m, group) for m in members]


def _require_creator(group: Group, current_user: User) -> None:
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator can do this")


@router.post("/{group_id}/members/{user_id}/approve", response_model=MemberOut)
def approve_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    _require_creator(group, current_user)
    m = _membership(db, user_id, group_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Member not found")
    m.status = "active"
    db.commit()
    return _member_out(m, group)


@router.post("/{group_id}/members/{user_id}/reject", status_code=204)
def reject_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    _require_creator(group, current_user)
    if user_id == group.creator_id:
        raise HTTPException(status_code=400, detail="Cannot remove the creator")
    m = _membership(db, user_id, group_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(m)
    db.commit()
