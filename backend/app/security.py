import hashlib
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _pwd.verify(password, password_hash)
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except (JWTError, ValueError):
        return None


def _pw_fingerprint(password_hash: str) -> str:
    """Short fingerprint of the current password hash. Embedding it in the reset
    token means the link stops working as soon as the password changes — so a
    used (or stale) link can't reset the password a second time."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_password_reset_token(user_id: int, password_hash: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "purpose": "pwreset",
        "fp": _pw_fingerprint(password_hash),
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_password_reset_token(token: str) -> tuple[int, str] | None:
    """Returns (user_id, fingerprint) if the token is a valid, unexpired reset
    token, else None. The caller must still confirm the fingerprint matches the
    user's *current* password hash."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    if payload.get("purpose") != "pwreset":
        return None
    sub, fp = payload.get("sub"), payload.get("fp")
    if sub is None or fp is None:
        return None
    try:
        return int(sub), str(fp)
    except ValueError:
        return None
