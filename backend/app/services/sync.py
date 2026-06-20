"""Synchronization of API-Football data into local Match rows, plus
automatic score recalculation when a match finishes."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Match, Column, Prediction, Score, ScoreHistory
from app.services import football_api
from app.services.scoring import score_prediction

logger = logging.getLogger(__name__)

_LIVE_SHORT = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"}
_FINISHED_SHORT = {"FT", "AET", "PEN"}


def _map_status(short: str | None) -> str:
    if short in _LIVE_SHORT:
        return "live"
    if short in _FINISHED_SHORT:
        return "finished"
    return "scheduled"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _stat(stats_block: list[dict], type_name: str):
    for item in stats_block:
        if item.get("type") == type_name:
            return item.get("value")
    return None


def _to_int(value, default=None):
    if value is None:
        return default
    if isinstance(value, str):
        value = value.replace("%", "").strip()
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def _to_float(value, default=None):
    if value is None:
        return default
    if isinstance(value, str):
        value = value.replace("%", "").strip()
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def upsert_fixture(db: Session, fx: dict) -> Match | None:
    fixture = fx.get("fixture", {})
    api_id = fixture.get("id")
    if api_id is None:
        return None

    teams = fx.get("teams", {})
    goals = fx.get("goals", {})
    league = fx.get("league", {})
    venue = fixture.get("venue", {}) or {}
    status_block = fixture.get("status", {}) or {}

    match = db.query(Match).filter(Match.api_id == api_id).one_or_none()
    if match is None:
        match = Match(api_id=api_id)
        db.add(match)

    prev_status = match.status

    match.home_team = teams.get("home", {}).get("name") or match.home_team or "TBD"
    match.away_team = teams.get("away", {}).get("name") or match.away_team or "TBD"
    match.home_team_id = teams.get("home", {}).get("id")
    match.away_team_id = teams.get("away", {}).get("id")
    match.kickoff_utc = _parse_dt(fixture.get("date")) or match.kickoff_utc
    match.phase = league.get("round") or match.phase
    match.venue = venue.get("name")
    match.status = _map_status(status_block.get("short"))
    match.minute = status_block.get("elapsed")
    match.home_score = goals.get("home")
    match.away_score = goals.get("away")

    db.flush()

    # When a match transitions into "finished", recalc its scores.
    if prev_status != "finished" and match.status == "finished":
        recalculate_match_scores(db, match, source="sync")

    return match


def apply_statistics(db: Session, match: Match, stats: list[dict]) -> None:
    """stats: API-Football /fixtures/statistics response (two team blocks)."""
    if not stats:
        return
    by_team = {block.get("team", {}).get("id"): block.get("statistics", []) for block in stats}
    home_block = by_team.get(match.home_team_id, [])
    away_block = by_team.get(match.away_team_id, [])

    match.home_possession = _to_float(_stat(home_block, "Ball Possession"))
    match.away_possession = _to_float(_stat(away_block, "Ball Possession"))
    match.home_shots = _to_int(_stat(home_block, "Total Shots"))
    match.away_shots = _to_int(_stat(away_block, "Total Shots"))
    match.home_xg = _to_float(_stat(home_block, "expected_goals"))
    match.away_xg = _to_float(_stat(away_block, "expected_goals"))
    match.home_yellows = _to_int(_stat(home_block, "Yellow Cards"), 0) or 0
    match.away_yellows = _to_int(_stat(away_block, "Yellow Cards"), 0) or 0
    match.home_reds = _to_int(_stat(home_block, "Red Cards"), 0) or 0
    match.away_reds = _to_int(_stat(away_block, "Red Cards"), 0) or 0
    match.raw_stats = {"statistics": stats}
    db.flush()


# ---- Score recalculation ----------------------------------------------

def _config_for_match(db: Session, match_id: int) -> dict | None:
    """Find an active/closed column that includes this match and use its config."""
    col = (
        db.query(Column)
        .filter(Column.match_ids.any(match_id))
        .order_by(Column.id.desc())
        .first()
    )
    return col.scoring_config if col else None


def _prediction_stats(predictions: list) -> dict:
    """Aggregate prediction stats for a match: 3 most-predicted scorelines and the
    most-chosen goalscorer. Deduped by user (multi-prode picks count once)."""
    from app.services.scoring import _name_tokens

    score_users: dict[tuple[int, int], set[int]] = {}
    scorer_users: dict[str, list] = {}  # normalized name -> [display_name, set(user_id)]
    for p in predictions:
        score_users.setdefault((p.pred_home_score, p.pred_away_score), set()).add(p.user_id)
        for pl in (p.pred_players or []):
            if int(pl.get("g", 0) or 0) > 0:
                nm = (pl.get("name") or "").strip()
                key = " ".join(sorted(_name_tokens(nm)))
                if not key:
                    continue
                entry = scorer_users.setdefault(key, [nm, set()])
                entry[1].add(p.user_id)
    top = sorted(score_users.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:3]
    top_scores = [{"score": f"{h}-{a}", "count": len(u)} for (h, a), u in top]
    top_scorer = None
    if scorer_users:
        nm, us = max(scorer_users.values(), key=lambda v: len(v[1]))
        top_scorer = {"name": nm, "count": len(us)}
    return {
        "voters": len({p.user_id for p in predictions}),
        "top_scores": top_scores,
        "top_scorer": top_scorer,
    }


def _score_snapshot(s: Score) -> dict:
    return {
        "pts_result": s.pts_result, "pts_exact": s.pts_exact, "pts_yellows": s.pts_yellows,
        "pts_reds": s.pts_reds, "pts_bonus": s.pts_bonus, "pts_scorers": s.pts_scorers,
        "pts_cards": s.pts_cards, "total": s.total,
    }


def recalculate_match_scores(
    db: Session, match: Match, allow_decrease: bool = False, source: str = "recalc"
) -> int:
    """Recompute Score rows for every prediction on a finished match.

    By default a recalc NEVER lowers an already-awarded total — points only go up
    or stay. This protects the leaderboard from retroactive subtractions when a
    scoring rule or scraped data changes after a match was scored. An admin
    editing the actual result (set_match_result) passes allow_decrease=True.

    Any change to an EXISTING score is recorded in score_history (before/after +
    source) so a wrong scoring event can be reviewed/undone later.
    """
    if match.status != "finished":
        return 0
    predictions = db.query(Prediction).filter(Prediction.match_id == match.id).all()
    count = 0
    for pred in predictions:
        col = db.get(Column, pred.column_id)
        config = col.scoring_config if col else None
        breakdown = score_prediction(pred, match, config)
        existing = pred.score
        if existing is not None and not allow_decrease and breakdown.total < existing.total:
            continue  # never strip points already given on a plain recalc
        old_snap = _score_snapshot(existing) if existing is not None else None
        score = existing or Score(prediction_id=pred.id)
        score.pts_result = breakdown.pts_result
        score.pts_exact = breakdown.pts_exact
        score.pts_yellows = breakdown.pts_yellows
        score.pts_reds = breakdown.pts_reds
        score.pts_bonus = breakdown.pts_bonus
        score.pts_scorers = breakdown.pts_scorers
        score.pts_cards = breakdown.pts_cards
        score.total = breakdown.total
        if existing is None:
            db.add(score)
        pred.locked = True
        count += 1
        # Audit only real CHANGES to a pre-existing score (skip initial scoring).
        new_snap = _score_snapshot(score)
        if old_snap is not None and old_snap != new_snap:
            db.add(ScoreHistory(
                prediction_id=pred.id, source=source,
                old_total=old_snap["total"], new_total=new_snap["total"],
                old_breakdown=old_snap, new_breakdown=new_snap,
            ))
    # Aggregate prediction stats (top scorelines + top goalscorer) for the match.
    match.prediction_stats = _prediction_stats(predictions)
    db.commit()
    return count


def recalculate_column(db: Session, column: Column, source: str = "recalc_column") -> int:
    """Recompute every prediction in a column whose match is finished."""
    total = 0
    for match_id in column.match_ids or []:
        match = db.get(Match, match_id)
        if match and match.status == "finished":
            total += recalculate_match_scores(db, match, source=source)
    return total


# ---- Sync entrypoints (called by the scheduler) -----------------------

async def load_full_fixture() -> int:
    """Load the complete Mundial 2026 fixture into the DB."""
    db = SessionLocal()
    try:
        fixtures = await football_api.get_fixtures(
            settings.WORLD_CUP_LEAGUE_ID, settings.WORLD_CUP_SEASON
        )
        for fx in fixtures:
            upsert_fixture(db, fx)
        db.commit()
        logger.info("Loaded %d fixtures", len(fixtures))
        return len(fixtures)
    finally:
        db.close()


async def sync_live_matches() -> int:
    """Update score / minute / stats for matches currently live (every 30s)."""
    db = SessionLocal()
    try:
        live = await football_api.get_live_fixtures(settings.WORLD_CUP_LEAGUE_ID)
        for fx in live:
            match = upsert_fixture(db, fx)
            if match and match.api_id:
                stats = await football_api.get_fixture_statistics(match.api_id)
                apply_statistics(db, match, stats)
        db.commit()
        _advance_bracket(db)
        return len(live)
    finally:
        db.close()


async def sync_today_matches() -> int:
    """Refresh today's upcoming matches (every 5 minutes)."""
    db = SessionLocal()
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        fixtures = await football_api.get_fixtures_by_date(
            today, settings.WORLD_CUP_LEAGUE_ID, settings.WORLD_CUP_SEASON
        )
        for fx in fixtures:
            upsert_fixture(db, fx)
        db.commit()
        _advance_bracket(db)
        return len(fixtures)
    finally:
        db.close()


def _advance_bracket(db: Session) -> None:
    """Propagate results into the knockout bracket (best-effort, never fatal)."""
    try:
        from app.services.bracket import resolve

        resolve(db)
    except Exception:  # noqa: BLE001
        logger.exception("Bracket resolution failed")


async def sync_team_stats() -> int:
    """Hourly refresh of fixture data so standings/stats stay fresh."""
    return await load_full_fixture()
