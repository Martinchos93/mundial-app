import redis

from app.config import settings

# decode_responses=True so we work with str instead of bytes
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


def get_redis() -> redis.Redis:
    return redis_client


# ---- Matches list cache (version-keyed; bump on any match write) ----------
_MATCHES_VER_KEY = "matches:ver"


def matches_cache_version() -> str | None:
    """Current cache version, or None if Redis is unavailable (skip caching)."""
    try:
        return redis_client.get(_MATCHES_VER_KEY) or "0"
    except Exception:  # noqa: BLE001 — Redis down → caller skips the cache
        return None


def matches_cache_get(key: str) -> str | None:
    try:
        return redis_client.get(key)
    except Exception:  # noqa: BLE001
        return None


def matches_cache_set(key: str, value: str, ttl: int) -> None:
    try:
        redis_client.setex(key, ttl, value)
    except Exception:  # noqa: BLE001
        pass


def bump_matches_cache() -> None:
    """Invalidate every cached /matches response (called after any match write)."""
    try:
        redis_client.incr(_MATCHES_VER_KEY)
    except Exception:  # noqa: BLE001
        pass
