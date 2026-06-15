import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.ratelimit import limiter
from app.routers import (
    auth,
    matches,
    teams,
    players,
    predictions,
    groups,
    leaderboard,
    ai,
    admin,
    standings,
    stats,
    news,
    bracket,
    squads,
    media,
    settings as settings_router,
    contact,
    futgolf,
)
from app.tasks.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _ensure_group_integrity() -> None:
    """Self-heal: every prode needs an active scoring column."""
    from app.database import SessionLocal
    from app.models import Group, Column
    from app.models.column import DEFAULT_SCORING_CONFIG

    db = SessionLocal()
    try:
        for g in db.query(Group).all():
            if db.query(Column).filter(Column.group_ids.any(g.id)).count() == 0:
                db.add(
                    Column(
                        name="General",
                        status="active",
                        group_ids=[g.id],
                        match_ids=[],
                        scoring_config=dict(DEFAULT_SCORING_CONFIG),
                    )
                )
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Group integrity check failed")
    finally:
        db.close()


def _bootstrap_admin() -> None:
    """Create the first admin user from env vars if no admin exists yet."""
    from app.database import SessionLocal
    from app.models import User
    from app.security import hash_password

    db = SessionLocal()
    try:
        if db.query(User).filter(User.is_admin == True).first():  # noqa: E712
            return
        if db.query(User).filter(User.username == settings.ADMIN_USERNAME).first():
            return
        db.add(
            User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                first_name="Admin",
                last_name="Mundial",
                is_admin=True,
            )
        )
        db.commit()
        logger.info("Bootstrapped admin user '%s'", settings.ADMIN_USERNAME)
    except Exception:  # noqa: BLE001
        logger.exception("Admin bootstrap failed")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load full fixture on boot, then start periodic sync jobs.
    try:
        from app.services.sync import load_full_fixture

        await load_full_fixture()
    except Exception:  # noqa: BLE001
        logger.exception("Initial fixture load failed (continuing)")
    _seed_fixture_if_empty()
    _sync_kickoffs()
    _ensure_group_integrity()
    _bootstrap_admin()
    _load_squads()
    start_scheduler()
    yield
    stop_scheduler()


def _seed_fixture_if_empty() -> None:
    """If no matches exist (fresh DB and the free API can't serve 2026),
    seed the official Mundial 2026 fixture + bracket. Never wipes existing data."""
    from app.database import SessionLocal
    from app.models import Match

    db = SessionLocal()
    try:
        if db.query(Match).count() == 0:
            from app.seed_2026 import seed

            n = seed()
            logger.info("Seeded %d matches into empty DB", n)
    except Exception:  # noqa: BLE001
        logger.exception("Fixture auto-seed failed")
    finally:
        db.close()


def _sync_kickoffs() -> None:
    """Correct group-match kickoff times in place (no data wiped) so existing
    deployments pick up schedule fixes."""
    try:
        from app.seed_2026 import sync_kickoffs

        n = sync_kickoffs()
        if n:
            logger.info("Corrected kickoff times for %d matches", n)
    except Exception:  # noqa: BLE001
        logger.exception("Kickoff sync failed")


def _load_squads() -> None:
    from app.database import SessionLocal
    from app.services.squads import load_static_squads

    db = SessionLocal()
    try:
        load_static_squads(db)
    except Exception:  # noqa: BLE001
        logger.exception("Static squad load failed")
    finally:
        db.close()


app = FastAPI(title="Mundial 2026 API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, matches, teams, players, predictions, groups, leaderboard, ai, admin, standings, stats):
    app.include_router(r.router)
app.include_router(leaderboard.global_router)
app.include_router(futgolf.router)
app.include_router(news.router)
app.include_router(news.admin_router)
app.include_router(bracket.router)
app.include_router(squads.router)
app.include_router(media.router)
app.include_router(media.admin_router)
app.include_router(settings_router.router)
app.include_router(settings_router.admin_router)
app.include_router(contact.router)
app.include_router(contact.admin_router)


@app.get("/health", tags=["meta"])
def health():
    # Railway injects the deployed commit SHA — expose it so we can verify which
    # version is live without dashboard access.
    commit = os.getenv("RAILWAY_GIT_COMMIT_SHA") or "dev"
    return {"status": "ok", "commit": commit[:7]}
