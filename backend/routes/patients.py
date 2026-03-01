"""
routes/patients.py – Patient registration and queue endpoints
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Patient, PatientStatus, EventLog
from schemas import PatientRegisterRequest, PatientResponse, RegistrationResponse, QueueEntry
from redis_client import get_next_token, queue_length
from queue_engine import (
    add_patient_to_queue,
    get_ordered_queue,
    get_queue_stats,
    recalculate_queue,
    estimate_wait_time,
    get_queue_position,
)
from doctor_engine import get_optimal_doctor, assign_doctor_to_patient, format_doctor_response, get_all_doctors
from websocket_manager import broadcast_queue_updated, broadcast_patient_status_changed
from ml_engine.groq_engine import analyze_urgency

router = APIRouter(prefix="/patients", tags=["patients"])


async def _broadcast_full_update(db: AsyncSession):
    """Helper: pull latest queue + stats and broadcast to all clients."""
    queue_data = await get_ordered_queue(db)
    stats = await get_queue_stats(db)
    await broadcast_queue_updated(queue_data, stats)


@router.post("/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register_patient(payload: PatientRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a patient, get a token, join the Redis priority queue, and optionally
    get assigned to an available doctor. Emits queue_updated WebSocket event.
    """
    # 1. Generate sequential token number
    token_number = await get_next_token()

    # Determine urgency automatically if reason is provided
    # The frontend is updated to send reason instead of hardcoded visitType
    determined_urgency = await analyze_urgency(payload.reason)

    # 2. Save patient to DB
    patient = Patient(
        token_number=token_number,
        name=payload.name,
        phone=payload.phone,
        reason=payload.reason,
        urgency=determined_urgency,
        status=PatientStatus.WAITING,
        created_at=datetime.now(timezone.utc),
    )
    db.add(patient)
    await db.flush()  # Get the generated ID without committing

    # 3. Assign optimal doctor if available
    doctor = await get_optimal_doctor(db)
    if doctor:
        await assign_doctor_to_patient(db, patient, doctor)
        await db.flush()

    await db.commit()
    await db.refresh(patient)

    # 4. Insert into Redis priority queue
    score = await add_patient_to_queue(patient)
    position = await get_queue_position(patient.id)
    if position == -1:
        position = await queue_length()
    wait_minutes = estimate_wait_time(position)

    # 5. Log event
    event = EventLog(
        event_type="patient_registered",
        reference_id=patient.id,
        metadata_json=json.dumps({"token": token_number, "urgency": determined_urgency, "ai_rated": True}),
    )
    db.add(event)
    await db.commit()

    # 6. Broadcast WebSocket update
    await _broadcast_full_update(db)

    # 7. Build response
    doctor_name = None
    if patient.assigned_doctor_id:
        from sqlalchemy import select as sa_select
        from models import Doctor
        res = await db.execute(sa_select(Doctor.name).where(Doctor.id == patient.assigned_doctor_id))
        doctor_name = res.scalar_one_or_none()

    patient_resp = PatientResponse(
        id=patient.id,
        token_number=patient.token_number,
        name=patient.name,
        phone=patient.phone,
        reason=patient.reason,
        urgency=patient.urgency,
        status=patient.status,
        assigned_doctor_id=patient.assigned_doctor_id,
        assigned_doctor_name=doctor_name,
        created_at=patient.created_at,
        consultation_start=patient.consultation_start,
        consultation_end=patient.consultation_end,
        queue_position=position,
        estimated_wait_minutes=wait_minutes,
    )

    return RegistrationResponse(
        patient=patient_resp,
        token_number=token_number,
        queue_position=position,
        estimated_wait_minutes=wait_minutes,
        message=f"Token #{token_number:03d} issued. You are #{position} in line. Estimated wait: {wait_minutes} min.",
    )


@router.get("/queue", response_model=list[QueueEntry])
async def get_queue(db: AsyncSession = Depends(get_db)):
    """
    Get the full live queue ordered by priority (highest urgency + longest wait first).
    Also includes patients whose status is IN_CONSULTATION for the doctor view.
    """
    ordered = await get_ordered_queue(db)
    
    # Also get in_consultation patients (not in Redis ZSET but shown on doctor view)
    result = await db.execute(
        select(Patient)
        .where(Patient.status == PatientStatus.IN_CONSULTATION)
    )
    consulting = result.scalars().all()

    from models import Doctor
    consulting_entries = []
    for p in consulting:
        doc_name = None
        if p.assigned_doctor_id:
            res = await db.execute(select(Doctor.name).where(Doctor.id == p.assigned_doctor_id))
            doc_name = res.scalar_one_or_none()
        consulting_entries.append({
            "id": p.id,
            "token_number": p.token_number,
            "name": p.name,
            "reason": p.reason,
            "urgency": p.urgency,
            "status": p.status.value,
            "assigned_doctor_id": p.assigned_doctor_id,
            "assigned_doctor_name": doc_name,
            "created_at": p.created_at.isoformat(),
            "queue_position": 0,
            "estimated_wait_minutes": 0,
            "priority_score": 0.0,
        })

    return ordered + consulting_entries


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    return await get_queue_stats(db)


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    position = await get_queue_position(patient.id)
    wait = estimate_wait_time(position) if position > 0 else 0

    return PatientResponse(
        id=patient.id,
        token_number=patient.token_number,
        name=patient.name,
        phone=patient.phone,
        reason=patient.reason,
        urgency=patient.urgency,
        status=patient.status,
        assigned_doctor_id=patient.assigned_doctor_id,
        created_at=patient.created_at,
        consultation_start=patient.consultation_start,
        consultation_end=patient.consultation_end,
        queue_position=position if position > 0 else None,
        estimated_wait_minutes=wait if wait > 0 else None,
    )
