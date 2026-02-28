"""
config.py – Centralised settings using pydantic-settings
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
from dotenv import load_dotenv
import os

_env_file = Path(__file__).parent / ".env"
load_dotenv(_env_file)

class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://mediq:mediq@localhost:5432/mediq"
    )
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/1")
    CELERY_RESULT_BACKEND: str = Field(default="redis://localhost:6379/2")
    SECRET_KEY: str = Field(...)
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000"
    )

    # LLM Settings
    GROQ_API_KEY: str = Field(default="")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}
settings = Settings()
