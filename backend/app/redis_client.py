import redis

from app.config import settings

# decode_responses=True so we work with str instead of bytes
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


def get_redis() -> redis.Redis:
    return redis_client
