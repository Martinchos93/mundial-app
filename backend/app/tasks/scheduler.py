"""APScheduler jobs that keep match data and AI predictions fresh.

The API-Football free plan allows only 100 requests/day, so every job first
checks local DB state and skips the external call when nothing needs syncing
(idle days cost ~0 requests). The Redis cache in football_api further
deduplicates identical calls within their TTL window.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func

from app.database import SessionLocal
from app.models import Match, AIPrediction
from app.services import sync
from app.services.anthropic_ai import generate_match_prediction

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")


def _has_active_window(db) -> bool:
    """True if any match is live, or kicks off within the next 2 hours."""
    now = datetime.now(timezone.utc)
    soon = now + timedelta(hours=2)
    live = db.query(func.count(Match.id)).filter(Match.status == "live").scalar() or 0
    if live:
        return True
    upcoming = (
        db.query(func.count(Match.id))
        .filter(Match.status == "scheduled", Match.kickoff_utc >= now, Match.kickoff_utc <= soon)
        .scalar()
        or 0
    )
    return bool(upcoming)


def _has_today_matches(db) -> bool:
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return bool(
        db.query(func.count(Match.id))
        .filter(Match.kickoff_utc >= start, Match.kickoff_utc < end)
        .scalar()
        or 0
    )


async def _job_live() -> None:
    db = SessionLocal()
    try:
        if not _has_active_window(db):
            return  # no live/imminent matches -> don't spend a request
    finally:
        db.close()
    try:
        n = await sync.sync_live_matches()
        if n:
            logger.info("Live sync updated %d matches", n)
    except Exception:  # noqa: BLE001
        logger.exception("Live sync job failed")


async def _job_today() -> None:
    db = SessionLocal()
    try:
        if not _has_today_matches(db):
            return
    finally:
        db.close()
    try:
        await sync.sync_today_matches()
    except Exception:  # noqa: BLE001
        logger.exception("Today sync job failed")


async def _job_hourly() -> None:
    try:
        await sync.sync_team_stats()
    except Exception:  # noqa: BLE001
        logger.exception("Hourly sync job failed")


async def _job_ai_pregame() -> None:
    """Generate AI predictions for matches kicking off in ~2 hours."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        window_start = now + timedelta(hours=2)
        window_end = now + timedelta(hours=2, minutes=15)
        matches = (
            db.query(Match)
            .filter(Match.status == "scheduled")
            .filter(Match.kickoff_utc >= window_start)
            .filter(Match.kickoff_utc <= window_end)
            .all()
        )
        for match in matches:
            existing = (
                db.query(AIPrediction)
                .filter(AIPrediction.match_id == match.id)
                .order_by(AIPrediction.generated_at.desc())
                .first()
            )
            recent = existing and (now - existing.generated_at) < timedelta(hours=6)
            if not recent:
                await generate_match_prediction(db, match.id, force=True)
                logger.info("Pre-game AI prediction generated for match %s", match.id)
    except Exception:  # noqa: BLE001
        logger.exception("AI pre-game job failed")
    finally:
        db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return
    # Conservative cadences for the 100 req/day free plan. The DB gating in
    # _job_live / _job_today keeps idle periods at zero external requests.
    scheduler.add_job(_job_live, "interval", seconds=60, id="live", max_instances=1)
    scheduler.add_job(_job_today, "interval", minutes=15, id="today", max_instances=1)
    scheduler.add_job(_job_hourly, "interval", hours=6, id="hourly", max_instances=1)
    scheduler.add_job(_job_ai_pregame, "interval", minutes=15, id="ai_pregame", max_instances=1)
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
