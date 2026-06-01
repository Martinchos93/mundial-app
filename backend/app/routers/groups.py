from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, Column
from app.schemas.group import GroupOut
from app.schemas.column import ColumnOut

router = APIRouter(prefix="/groups", tags=["groups"])


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
