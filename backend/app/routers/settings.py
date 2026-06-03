"""Global app settings / feature flags (e.g. AI predictions on/off)."""
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Setting

# Defaults applied when a key has never been set.
DEFAULTS: dict[str, Any] = {
    "ai_enabled": False,  # show the "Generar con IA" prediction option
}

router = APIRouter(tags=["settings"])
admin_router = APIRouter(prefix="/admin", tags=["settings"], dependencies=[Depends(get_current_admin)])


def _all(db: Session) -> dict[str, Any]:
    stored = {s.key: (s.value or {}).get("v") for s in db.query(Setting).all()}
    return {**DEFAULTS, **stored}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return _all(db)


class SettingIn(BaseModel):
    key: str
    value: Any


@admin_router.put("/settings")
def set_setting(payload: SettingIn, db: Session = Depends(get_db)):
    s = db.get(Setting, payload.key)
    if s is None:
        s = Setting(key=payload.key, value={"v": payload.value})
        db.add(s)
    else:
        s.value = {"v": payload.value}
    db.commit()
    return _all(db)
