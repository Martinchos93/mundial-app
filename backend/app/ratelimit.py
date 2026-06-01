from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Use Redis as the shared store so limits hold across workers.
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)
