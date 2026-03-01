"""
main.py – FastAPI application entry point with Socket.IO mount
"""
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
from pathlib import Path
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import settings
from database import create_tables
from redis_client import init_redis, close_redis
from websocket_manager import sio
from routes import patients as patients_router
from routes import doctors as doctors_router
from routes import staff as staff_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    # ─── Startup ───────────────────────────────────────────────────────────────
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info("[MediQ] Starting up...")

    # 1. Create DB tables
    try:
        await create_tables()
        logger.info("[MediQ] Database tables ready")
    except Exception as e:
        logger.error(f"[MediQ] Database initialization failed: {e}")
        raise e  # Crash clearly if DB fails

    # 2. Connect Redis
    try:
        await init_redis()
        logger.info("[MediQ] Redis connected")
    except Exception as e:
        logger.warning(f"[MediQ] Redis connection failed, continuing without it: {e}")

    # 3. Seed initial data if DB is empty
    try:
        from seed import seed_if_empty
        await seed_if_empty()
        logger.info("[MediQ] Seed check complete")
    except Exception as e:
        logger.error(f"[MediQ] Seeding failed: {e}")

    yield

    # ─── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("[MediQ] Shutting down...")
    try:
        await close_redis()
    except Exception as e:
        logger.error(f"[MediQ] Redis shutdown failed: {e}")


# Create the base FastAPI application
app = FastAPI(
    title="MediQ API",
    description="Real-time intelligent clinic queue management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

from fastapi.responses import JSONResponse
from fastapi import Request
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logging.error(f"Global exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error. Please try again later."},
    )

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://mediq-pink.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(patients_router.router, prefix="/api")
app.include_router(doctors_router.router, prefix="/api")
app.include_router(staff_router.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check for load balancers / monitoring."""
    from redis_client import get_redis
    try:
        r = get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    return {
        "status": "ok" if redis_ok else "degraded",
        "redis": "ok" if redis_ok else "error",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── Mount Socket.IO on the FastAPI ASGI app ──────────────────────────────────
# Socket.IO requests go to:  /socket.io/...
# REST API requests go to:   /api/...
app.mount("/socket.io", socketio.ASGIApp(
    socketio_server=sio,
    socketio_path=""
))
