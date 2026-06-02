from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from pydantic import BaseModel, Field, EmailStr

from app.database import get_db
from app.deps import get_current_admin
from app.models import Column, Match, Prediction, User, Group, AIPrediction, Membership
from app.models.column import DEFAULT_SCORING_CONFIG
from app.schemas.column import ColumnCreate, ColumnUpdate, ColumnOut, ColumnStats
from app.schemas.auth import UserOut
from app.security import hash_password
from app.services.sync import recalculate_column

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


class AdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    password: str = Field(..., min_length=6, max_length=128)
    first_name: str = Field(default="Admin", max_length=80)
    last_name: str = Field(default="", max_length=80)
    email: EmailStr


@router.get("/admins", response_model=list[UserOut])
def list_admins(db: Session = Depends(get_db)):
    return [UserOut.model_validate(u) for u in db.query(User).filter(User.is_admin == True).all()]  # noqa: E712


@router.post("/admins", response_model=UserOut, status_code=201)
def create_admin(payload: AdminCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == str(payload.email)))
        .first()
    )
    if existing:
        # Promote an existing matching user to admin instead of erroring.
        existing.is_admin = True
        db.commit()
        db.refresh(existing)
        return UserOut.model_validate(existing)
    u = User(
        username=payload.username,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        is_admin=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return UserOut.model_validate(u)


@router.post("/admins/{user_id}/revoke", response_model=UserOut)
def revoke_admin(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_admin = False
    db.commit()
    db.refresh(u)
    return UserOut.model_validate(u)


@router.get("/users")
def list_users(
    q: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Paginated, searchable list of all accounts (admin only)."""
    query = db.query(User)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.email.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
            )
        )
    total = query.with_entities(func.count(User.id)).scalar() or 0
    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    # prode counts in one query
    counts = dict(
        db.query(Membership.user_id, func.count(Membership.id))
        .filter(Membership.user_id.in_([u.id for u in users]))
        .group_by(Membership.user_id)
        .all()
    )
    items = []
    for u in users:
        d = UserOut.model_validate(u).model_dump(mode="json")
        d["prodes"] = int(counts.get(u.id, 0))
        items.append(d)
    return {"items": items, "total": int(total), "page": page, "page_size": page_size}


def _column_stats(db: Session, col: Column) -> ColumnStats:
    total_predictions = (
        db.query(func.count(Prediction.id)).filter(Prediction.column_id == col.id).scalar() or 0
    )
    base = ColumnOut.model_validate(col).model_dump()
    return ColumnStats(
        **base,
        total_predictions=int(total_predictions),
        total_matches=len(col.match_ids or []),
        total_groups=len(col.group_ids or []),
    )


@router.get("/columns", response_model=list[ColumnStats])
def list_columns(db: Session = Depends(get_db)):
    cols = db.query(Column).order_by(Column.created_at.desc()).all()
    return [_column_stats(db, c) for c in cols]


@router.post("/columns", response_model=ColumnOut, status_code=201)
def create_column(payload: ColumnCreate, db: Session = Depends(get_db)):
    col = Column(
        name=payload.name,
        phase=payload.phase,
        group_ids=payload.group_ids,
        match_ids=payload.match_ids,
        scoring_config=payload.scoring_config or dict(DEFAULT_SCORING_CONFIG),
        starts_at=payload.starts_at,
        closes_at=payload.closes_at,
        status="draft",
    )
    db.add(col)
    db.commit()
    db.refresh(col)
    return ColumnOut.model_validate(col)


@router.put("/columns/{column_id}", response_model=ColumnOut)
def update_column(column_id: int, payload: ColumnUpdate, db: Session = Depends(get_db)):
    col = db.get(Column, column_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(col, field, value)
    db.commit()
    db.refresh(col)
    return ColumnOut.model_validate(col)


@router.post("/columns/{column_id}/activate", response_model=ColumnOut)
def activate_column(column_id: int, db: Session = Depends(get_db)):
    col = db.get(Column, column_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    col.status = "active"
    db.commit()
    db.refresh(col)
    return ColumnOut.model_validate(col)


@router.post("/columns/{column_id}/close", response_model=ColumnOut)
def close_column(column_id: int, db: Session = Depends(get_db)):
    col = db.get(Column, column_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    col.status = "closed"
    db.commit()
    db.refresh(col)
    return ColumnOut.model_validate(col)


@router.post("/columns/{column_id}/recalculate")
def recalculate(column_id: int, db: Session = Depends(get_db)):
    col = db.get(Column, column_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    count = recalculate_column(db, col)
    return {"column_id": column_id, "recalculated_predictions": count}


@router.get("/stats")
def global_stats(db: Session = Depends(get_db)):
    return {
        "users": db.query(func.count(User.id)).scalar() or 0,
        "groups": db.query(func.count(Group.id)).scalar() or 0,
        "matches": db.query(func.count(Match.id)).scalar() or 0,
        "live_matches": db.query(func.count(Match.id)).filter(Match.status == "live").scalar() or 0,
        "predictions": db.query(func.count(Prediction.id)).scalar() or 0,
        "ai_predictions": db.query(func.count(AIPrediction.id)).scalar() or 0,
        "columns": db.query(func.count(Column.id)).scalar() or 0,
    }
