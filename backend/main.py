"""
main.py – FastAPI application entry point with Socket.IO mount
"""
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import create_tables
from .redis_client import init_redis, close_redis
from .websocket_manager import sio
from .routes import patients as patients_router
from .routes import doctors as doctors_router
from .routes import staff as staff_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    # ─── Startup ───────────────────────────────────────────────────────────────
    print("[MediQ] Starting up...")

    # 1. Create DB tables
    await create_tables()
    print("[MediQ] Database tables ready")

    # 2. Connect Redis
    await init_redis()
    print("[MediQ] Redis connected")

    # 3. Seed initial data if DB is empty
    from .seed import seed_if_empty
    await seed_if_empty()
    print("[MediQ] Seed check complete")

    yield

    # ─── Shutdown ─────────────────────────────────────────────────────────────
    print("[MediQ] Shutting down...")
    await close_redis()


# Create the base FastAPI application
_fastapi_app = FastAPI(
    title="MediQ API",
    description="Real-time intelligent clinic queue management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow the Vite frontend
_fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
_fastapi_app.include_router(patients_router.router, prefix="/api")
_fastapi_app.include_router(doctors_router.router, prefix="/api")
_fastapi_app.include_router(staff_router.router, prefix="/api")


@_fastapi_app.get("/")
async def root():
    return {
        "service": "MediQ Backend",
        "version": "1.0.0",
        "status": "live",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "docs": "/docs",
    }


@_fastapi_app.get("/health")
async def health():
    """Health check for load balancers / monitoring."""
    from .redis_client import get_redis
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
app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=_fastapi_app,
    socketio_path="/socket.io",
)
