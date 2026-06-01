import logging
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
)
from app.tasks.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load full fixture on boot, then start periodic sync jobs.
    try:
        from app.services.sync import load_full_fixture

        await load_full_fixture()
    except Exception:  # noqa: BLE001
        logger.exception("Initial fixture load failed (continuing)")
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Mundial 2026 API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, matches, teams, players, predictions, groups, leaderboard, ai, admin, standings):
    app.include_router(r.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
