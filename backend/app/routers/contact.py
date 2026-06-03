"""Contact form: public submit + admin inbox."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import ContactMessage

router = APIRouter(tags=["contact"])
admin_router = APIRouter(prefix="/admin", tags=["contact"], dependencies=[Depends(get_current_admin)])


class ContactIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    message: str = Field(..., min_length=1, max_length=2000)


class ContactOut(BaseModel):
    id: int
    name: str
    email: str
    message: str
    handled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/contact", status_code=201)
def submit_contact(payload: ContactIn, db: Session = Depends(get_db)):
    m = ContactMessage(name=payload.name.strip(), email=str(payload.email), message=payload.message.strip())
    db.add(m)
    db.commit()
    return {"ok": True}


@admin_router.get("/contact", response_model=list[ContactOut])
def list_contact(db: Session = Depends(get_db)):
    rows = db.query(ContactMessage).order_by(ContactMessage.created_at.desc()).all()
    return [ContactOut.model_validate(r) for r in rows]


@admin_router.post("/contact/{msg_id}/handled", response_model=ContactOut)
def mark_handled(msg_id: int, db: Session = Depends(get_db)):
    m = db.get(ContactMessage, msg_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Message not found")
    m.handled = not m.handled
    db.commit()
    db.refresh(m)
    return ContactOut.model_validate(m)


@admin_router.delete("/contact/{msg_id}", status_code=204)
def delete_contact(msg_id: int, db: Session = Depends(get_db)):
    m = db.get(ContactMessage, msg_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(m)
    db.commit()
