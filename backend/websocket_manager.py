"""
websocket_manager.py – Socket.IO async server + broadcast helpers
"""
import socketio
import json
from typing import Optional, Any

# Create the Socket.IO async server
# cors_allowed_origins allows the Vite dev server to connect
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


# ─────────────────────────── Connection Handlers ──────────────────────────────

@sio.event
async def connect(sid, environ, auth=None):
    print(f"[WS] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[WS] Client disconnected: {sid}")


@sio.event
async def ping(sid, data=None):
    await sio.emit("pong", {"status": "ok"}, to=sid)


# ─────────────────────────── Broadcast Helpers ────────────────────────────────

async def broadcast_queue_updated(queue_data: list[dict], stats: dict) -> None:
    """Emit full queue snapshot to all connected clients."""
    await sio.emit(
        "queue_updated",
        {"queue": queue_data, "stats": stats},
    )


async def broadcast_patient_status_changed(
    patient_id: int,
    token_number: int,
    status: str,
    doctor_name: Optional[str] = None,
) -> None:
    await sio.emit(
        "patient_status_changed",
        {
            "patient_id": patient_id,
            "token_number": token_number,
            "status": status,
            "doctor_name": doctor_name,
        },
    )


async def broadcast_doctor_status_changed(
    doctor_id: int,
    doctor_name: str,
    is_active: bool,
    is_on_break: bool,
    current_patient_id: Optional[int] = None,
) -> None:
    await sio.emit(
        "doctor_status_changed",
        {
            "doctor_id": doctor_id,
            "doctor_name": doctor_name,
            "is_active": is_active,
            "is_on_break": is_on_break,
            "current_patient_id": current_patient_id,
        },
    )


async def broadcast_emergency_added(
    patient_id: int,
    token_number: int,
    name: str,
    urgency: int,
) -> None:
    await sio.emit(
        "emergency_added",
        {
            "patient_id": patient_id,
            "token_number": token_number,
            "name": name,
            "urgency": urgency,
        },
    )
