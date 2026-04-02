from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    API_V1_PREFIX: str = "/api"
    BACKEND_CORS_ORIGINS: list[str] = Field(default=["http://localhost:3000"])
    AGENT_MODEL: str = "llama3.2:3b"
    AGENT_FALLBACK_MODELS: list[str] = Field(default=["llama3.2:latest", "mistral:latest"])
    AGENT_TEMPERATURE: float = 0.1
    AGENT_NUM_PREDICT: int = 1200
    AGENT_TIMEOUT_SECONDS: float = 12.0
    AGENT_MAX_SERVER_ATTEMPTS: int = 4

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> "Settings":
    return Settings()


settings = get_settings()
