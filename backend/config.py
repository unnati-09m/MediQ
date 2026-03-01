"""
config.py – Centralised settings enforcing environment variables for production.
"""
import os
import sys
import logging
from dotenv import load_dotenv

# Optional: Load local .env just in case it exists locally, but for Render,
# it will rely on standard OS environment variables.
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_required_env(key: str) -> str:
    """Fetch an environment variable or crash if missing."""
    val = os.getenv(key)
    if not val:
        logger.error(f"Configuration error: Missing required environment variable: {key}")
        sys.exit(1)
    return val

# 1. Strictly enforce required variables
DATABASE_URL = get_required_env("DATABASE_URL")
REDIS_URL = get_required_env("REDIS_URL")
GROQ_API_KEY = get_required_env("GROQ_API_KEY")

# Fix Render Postgres URL to use asyncpg
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Optional / Default Settings
SECRET_KEY = os.getenv("SECRET_KEY", "placeholder_secret_key_for_dev_if_missing")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "")

class Settings:
    DATABASE_URL = DATABASE_URL
    REDIS_URL = REDIS_URL
    GROQ_API_KEY = GROQ_API_KEY
    SECRET_KEY = SECRET_KEY
    CORS_ORIGINS = CORS_ORIGINS
    CELERY_BROKER_URL = CELERY_BROKER_URL
    CELERY_RESULT_BACKEND = CELERY_RESULT_BACKEND
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

settings = Settings()
