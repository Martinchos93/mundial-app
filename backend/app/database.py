from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # drop dead connections before using them
    pool_recycle=900,         # recycle conns every 15 min (avoids stale ones)
    pool_size=10,
    max_overflow=10,          # up to 20 conns total
    pool_timeout=10,          # fail fast instead of piling up if exhausted
    future=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
