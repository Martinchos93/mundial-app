"""Polls / surveys. Admins create them; users answer once. Option-based polls
show live tallies; free-text polls collect up to 500 chars per user."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_admin
from app.models import User, Poll, PollResponse

router = APIRouter(prefix="/polls", tags=["polls"])
admin_router = APIRouter(prefix="/admin/polls", tags=["polls"], dependencies=[Depends(get_current_admin)])


def _active(db: Session) -> Poll | None:
    return db.query(Poll).filter(Poll.is_active.is_(True)).order_by(Poll.created_at.desc()).first()


def _tallies(db: Session, poll: Poll) -> tuple[list[int], int]:
    n = len(poll.options or [])
    counts = [0] * n
    rows = db.query(PollResponse.option_index).filter(
        PollResponse.poll_id == poll.id, PollResponse.option_index.isnot(None)
    ).all()
    total = 0
    for (idx,) in rows:
        if idx is not None and 0 <= idx < n:
            counts[idx] += 1
            total += 1
    return counts, total


@router.get("/active")
def active_poll(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    poll = _active(db)
    if poll is None:
        return {"poll": None}
    mine = db.query(PollResponse).filter(
        PollResponse.poll_id == poll.id, PollResponse.user_id == current_user.id
    ).first()
    out = {
        "id": poll.id,
        "question": poll.question,
        "kind": poll.kind,
        "options": poll.options or [],
        "answered": mine is not None,
        "my_option": mine.option_index if mine else None,
        "my_text": mine.text if mine else None,
    }
    if poll.kind == "options":
        counts, total = _tallies(db, poll)
        out["tallies"] = counts
        out["total"] = total
    return {"poll": out}


class RespondIn(BaseModel):
    option_index: int | None = None
    text: str | None = Field(default=None, max_length=500)


@router.post("/{poll_id}/respond")
def respond(poll_id: int, payload: RespondIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    poll = db.get(Poll, poll_id)
    if poll is None or not poll.is_active:
        raise HTTPException(status_code=404, detail="La encuesta no está disponible.")
    if poll.kind == "options":
        n = len(poll.options or [])
        if payload.option_index is None or not (0 <= payload.option_index < n):
            raise HTTPException(status_code=400, detail="Elegí una opción válida.")
    else:
        if not (payload.text or "").strip():
            raise HTTPException(status_code=400, detail="Escribí tu respuesta.")

    r = db.query(PollResponse).filter(
        PollResponse.poll_id == poll.id, PollResponse.user_id == current_user.id
    ).first()
    if r is None:
        r = PollResponse(poll_id=poll.id, user_id=current_user.id)
        db.add(r)
    r.option_index = payload.option_index if poll.kind == "options" else None
    r.text = (payload.text or "").strip()[:500] if poll.kind == "text" else None
    db.commit()
    return {"ok": True}


# --------------------------- admin ---------------------------

class PollCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=200)
    kind: str = Field(default="options")  # options | text
    options: list[str] = Field(default_factory=list)


@admin_router.post("")
def create_poll(payload: PollCreate, db: Session = Depends(get_db)):
    kind = payload.kind if payload.kind in ("options", "text") else "options"
    opts = [o.strip() for o in payload.options if o.strip()] if kind == "options" else None
    if kind == "options" and (not opts or len(opts) < 2):
        raise HTTPException(status_code=400, detail="Una encuesta de opciones necesita al menos 2 opciones.")
    # Only one active poll at a time.
    db.query(Poll).filter(Poll.is_active.is_(True)).update({Poll.is_active: False})
    p = Poll(question=payload.question.strip(), kind=kind, options=opts, is_active=True)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id}


@admin_router.get("")
def list_polls(db: Session = Depends(get_db)):
    polls = db.query(Poll).order_by(Poll.created_at.desc()).all()
    out = []
    for p in polls:
        total = db.query(PollResponse).filter(PollResponse.poll_id == p.id).count()
        out.append({
            "id": p.id, "question": p.question, "kind": p.kind, "options": p.options or [],
            "is_active": p.is_active, "responses": total,
        })
    return out


@admin_router.get("/{poll_id}/results")
def poll_results(poll_id: int, db: Session = Depends(get_db)):
    poll = db.get(Poll, poll_id)
    if poll is None:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    out = {"id": poll.id, "question": poll.question, "kind": poll.kind, "options": poll.options or []}
    if poll.kind == "options":
        counts, total = _tallies(db, poll)
        out["tallies"] = counts
        out["total"] = total
    else:
        rows = (
            db.query(PollResponse, User)
            .join(User, User.id == PollResponse.user_id)
            .filter(PollResponse.poll_id == poll.id, PollResponse.text.isnot(None))
            .order_by(PollResponse.created_at.desc())
            .all()
        )
        out["texts"] = [{"name": u.display_name, "text": r.text} for r, u in rows]
    return out


class PollPatch(BaseModel):
    is_active: bool


@admin_router.patch("/{poll_id}")
def patch_poll(poll_id: int, payload: PollPatch, db: Session = Depends(get_db)):
    poll = db.get(Poll, poll_id)
    if poll is None:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    if payload.is_active:
        db.query(Poll).filter(Poll.is_active.is_(True)).update({Poll.is_active: False})
    poll.is_active = payload.is_active
    db.commit()
    return {"ok": True}


@admin_router.delete("/{poll_id}")
def delete_poll(poll_id: int, db: Session = Depends(get_db)):
    poll = db.get(Poll, poll_id)
    if poll is not None:
        db.delete(poll)
        db.commit()
    return {"ok": True}
