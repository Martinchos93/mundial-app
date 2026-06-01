from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://user:pass@localhost:5432/mundial2026"
    REDIS_URL: str = "redis://localhost:6379"

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

    # Domain constants
    WORLD_CUP_LEAGUE_ID: int = 1
    WORLD_CUP_SEASON: int = 2026

    # Prediction lock: minutes before kickoff that predictions close
    PREDICTION_LOCK_MINUTES: int = 60

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
