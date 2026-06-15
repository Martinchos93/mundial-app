"""FutGolf — elimination minigame played by prode members.

Rules: each round every active player gets `shots_allowed` shots (3 normally).
Whoever sinks advances; whoever misses is out. If NOBODY sinks, nobody is
eliminated and a 1-shot tiebreak round is played. Last one standing wins.
Gated behind the `futgolf_enabled` flag + an allow-list (admins always in).
"""
import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_admin
from app.models import (
    User, Group, Membership, Setting,
    FutgolfTable, FutgolfParticipant, FutgolfAttempt, FutgolfView,
)

router = APIRouter(prefix="/futgolf", tags=["futgolf"])


def _setting(db: Session, key: str, default):
    s = db.get(Setting, key)
    return (s.value or {}).get("v", default) if s else default


def require_futgolf(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    if not _setting(db, "futgolf_enabled", False):
        raise HTTPException(status_code=403, detail="FutGolf no está habilitado.")
    if _setting(db, "futgolf_all", False):
        return current_user  # abierto a todos
    allowed = _setting(db, "futgolf_allowed", []) or []
    if not current_user.is_admin and current_user.id not in allowed:
        raise HTTPException(status_code=403, detail="No estás habilitado para FutGolf.")
    return current_user


def _members(db: Session, group_id: int) -> set[int]:
    return {
        m.user_id
        for m in db.query(Membership).filter(Membership.group_id == group_id, Membership.status == "active").all()
    }


def _table_out(db: Session, t: FutgolfTable, me: int) -> dict:
    parts = db.query(FutgolfParticipant).filter(FutgolfParticipant.table_id == t.id).all()
    users = {u.id: u for u in db.query(User).filter(User.id.in_([p.user_id for p in parts])).all()}
    submitted = {
        a.user_id
        for a in db.query(FutgolfAttempt).filter(
            FutgolfAttempt.table_id == t.id, FutgolfAttempt.round_no == t.round_no
        ).all()
    }
    participants = [
        {
            "user_id": p.user_id,
            "name": users[p.user_id].display_name if p.user_id in users else "?",
            "avatar_emoji": (users[p.user_id].avatar_emoji if p.user_id in users else "⚽") or "⚽",
            "status": p.status,
            "submitted": p.user_id in submitted,
        }
        for p in parts
    ]
    active = [p for p in parts if p.status == "active"]
    my = next((p for p in parts if p.user_id == me), None)
    return {
        "id": t.id,
        "group_id": t.group_id,
        "name": t.name,
        "status": t.status,
        "round_no": t.round_no,
        "shots_allowed": t.shots_allowed,
        "course_seed": t.course_seed,
        "winner_user_id": t.winner_user_id,
        "created_by": t.created_by,
        "participants": participants,
        "active_count": len(active),
        "my_status": my.status if my else None,
        "my_turn": bool(my and my.status == "active" and t.status == "playing" and me not in submitted),
        "pending": [p.user_id for p in active if p.user_id not in submitted],
    }


class CreateTable(BaseModel):
    group_id: int
    name: str = Field(..., min_length=1, max_length=80)
    member_user_ids: list[int] = Field(default_factory=list)


@router.post("/tables")
def create_table(payload: CreateTable, user: User = Depends(require_futgolf), db: Session = Depends(get_db)):
    members = _members(db, payload.group_id)
    if user.id not in members:
        raise HTTPException(status_code=403, detail="No sos miembro de ese prode.")
    ids = {user.id} | {uid for uid in payload.member_user_ids if uid in members}
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="Elegí al menos un rival del prode.")
    # Start playing immediately — the roster is fixed at creation, so a separate
    # "lobby" step only blocked invitees from seeing the play button.
    t = FutgolfTable(
        group_id=payload.group_id, name=payload.name.strip(), created_by=user.id,
        status="playing", course_seed=random.randint(1, 9_000_000), round_no=1, shots_allowed=3,
    )
    db.add(t); db.flush()
    for uid in ids:
        db.add(FutgolfParticipant(table_id=t.id, user_id=uid, status="active"))
    db.commit(); db.refresh(t)
    return _table_out(db, t, user.id)


@router.get("/tables")
def list_tables(group_id: int, user: User = Depends(require_futgolf), db: Session = Depends(get_db)):
    tables = (
        db.query(FutgolfTable)
        .filter(FutgolfTable.group_id == group_id)
        .order_by(FutgolfTable.created_at.desc())
        .limit(40)
        .all()
    )
    return [_table_out(db, t, user.id) for t in tables]


@router.get("/tables/{table_id}")
def get_table(table_id: int, user: User = Depends(require_futgolf), db: Session = Depends(get_db)):
    t = db.get(FutgolfTable, table_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    if t.status == "lobby":  # no lobby anymore — anyone can play any time
        t.status, t.round_no, t.shots_allowed = "playing", 1, 3
        db.commit()
    return _table_out(db, t, user.id)


@router.post("/tables/{table_id}/start")
def start_table(table_id: int, user: User = Depends(require_futgolf), db: Session = Depends(get_db)):
    t = db.get(FutgolfTable, table_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    if t.created_by != user.id:
        raise HTTPException(status_code=403, detail="Solo el creador puede empezar la mesa.")
    if t.status != "lobby":
        raise HTTPException(status_code=400, detail="La mesa ya empezó.")
    t.status = "playing"; t.round_no = 1; t.shots_allowed = 3
    db.commit(); db.refresh(t)
    return _table_out(db, t, user.id)


class SubmitResult(BaseModel):
    sunk: bool
    shots: int = Field(..., ge=0, le=10)


@router.post("/tables/{table_id}/submit")
def submit_result(table_id: int, payload: SubmitResult, user: User = Depends(require_futgolf), db: Session = Depends(get_db)):
    t = db.get(FutgolfTable, table_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    if t.status != "playing":
        raise HTTPException(status_code=400, detail="La mesa no está en juego.")
    me = next(
        (p for p in db.query(FutgolfParticipant).filter(FutgolfParticipant.table_id == t.id).all() if p.user_id == user.id),
        None,
    )
    if me is None or me.status != "active":
        raise HTTPException(status_code=403, detail="No estás jugando esta mesa.")
    already = db.query(FutgolfAttempt).filter(
        FutgolfAttempt.table_id == t.id, FutgolfAttempt.round_no == t.round_no, FutgolfAttempt.user_id == user.id
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="Ya jugaste esta ronda.")
    db.add(FutgolfAttempt(table_id=t.id, round_no=t.round_no, user_id=user.id, sunk=payload.sunk, shots=payload.shots))
    db.flush()
    _resolve_if_complete(db, t)
    db.commit(); db.refresh(t)
    return _table_out(db, t, user.id)


def _resolve_if_complete(db: Session, t: FutgolfTable) -> None:
    """Once every active player submitted this round, decide who advances."""
    active = db.query(FutgolfParticipant).filter(
        FutgolfParticipant.table_id == t.id, FutgolfParticipant.status == "active"
    ).all()
    attempts = {
        a.user_id: a
        for a in db.query(FutgolfAttempt).filter(
            FutgolfAttempt.table_id == t.id, FutgolfAttempt.round_no == t.round_no
        ).all()
    }
    if any(p.user_id not in attempts for p in active):
        return  # still waiting for someone

    sinkers = [p for p in active if attempts[p.user_id].sunk]
    if not sinkers:
        # nobody sank -> tiebreak (1 shot), nobody eliminated
        t.round_no += 1
        t.shots_allowed = 1
        return
    # eliminate the players who missed
    for p in active:
        if p not in sinkers:
            p.status = "eliminated"
    if len(sinkers) == 1:
        sinkers[0].status = "winner"
        t.status = "finished"
        t.winner_user_id = sinkers[0].user_id
    else:
        t.round_no += 1
        t.shots_allowed = 3


@router.post("/view")
def track_view(user: User = Depends(require_futgolf), db: Session = Depends(get_db)):
    """Records that this user opened the section (adoption metric, 1 row/user)."""
    v = db.get(FutgolfView, user.id)
    if v is None:
        db.add(FutgolfView(user_id=user.id, opens=1))
    else:
        v.opens += 1
    db.commit()
    return {"ok": True}


@router.get("/stats", dependencies=[Depends(get_current_admin)])
def futgolf_stats(db: Session = Depends(get_db)):
    """Adoption stats for the admin dashboard."""
    openers = db.query(func.count(FutgolfView.user_id)).scalar() or 0
    total_opens = int(db.query(func.coalesce(func.sum(FutgolfView.opens), 0)).scalar() or 0)
    players = db.query(func.count(func.distinct(FutgolfAttempt.user_id))).scalar() or 0
    creators = db.query(func.count(func.distinct(FutgolfTable.created_by))).scalar() or 0
    tables = db.query(func.count(FutgolfTable.id)).scalar() or 0
    finished = db.query(func.count(FutgolfTable.id)).filter(FutgolfTable.status == "finished").scalar() or 0
    rounds_played = db.query(func.count(FutgolfAttempt.id)).scalar() or 0
    sunk = db.query(func.count(FutgolfAttempt.id)).filter(FutgolfAttempt.sunk.is_(True)).scalar() or 0
    return {
        "openers": openers,            # personas que abrieron la sección
        "total_opens": total_opens,    # veces que se abrió
        "players": players,            # personas que jugaron al menos una ronda
        "creators": creators,          # personas que crearon una mesa
        "tables": tables,
        "finished_tables": finished,
        "rounds_played": rounds_played,
        "sunk": sunk,                  # rondas embocadas (para % de aciertos)
    }
