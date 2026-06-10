from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://user:pass@localhost:5432/mundial2026"
    REDIS_URL: str = "redis://localhost:6379"

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        # Railway/Heroku hand out postgres://; SQLAlchemy 2.0 needs postgresql://
        if v.startswith("postgres://"):
            return "postgresql://" + v[len("postgres://"):]
        return v

    FOOTBALL_API_KEY: str = ""
    FOOTBALL_API_HOST: str = "v3.football.api-sports.io"

    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days

    ADMIN_TOKEN: str = "change-me-admin-token"  # legacy, unused

    # First admin bootstrapped on startup if it doesn't exist.
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@mundial2026.app"
    ADMIN_PASSWORD: str = "admin1234"

    CORS_ORIGINS: str = "http://localhost:3000"
    # Regex fallback so the production domain + Vercel preview URLs are allowed
    # without having to enumerate every deploy URL. Override via env if needed.
    CORS_ORIGIN_REGEX: str = r"https://([a-z0-9-]+\.)*(prodegoat\.app|vercel\.app)"

    # Domain constants
    WORLD_CUP_LEAGUE_ID: int = 1
    WORLD_CUP_SEASON: int = 2026

    # Prediction lock: minutes before kickoff that predictions close
    # Minutes before kickoff that predictions lock. 0 = editable until kickoff.
    PREDICTION_LOCK_MINUTES: int = 0

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
