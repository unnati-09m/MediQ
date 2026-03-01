"""
routes/staff.py – Staff control endpoints
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Patient, PatientStatus, Doctor, EventLog
from schemas import WalkInRequest, EmergencyRequest, ToggleDoctorRequest
from redis_client import get_next_token, queue_length
from queue_engine import (
    add_patient_to_queue,
    recalculate_queue,
    remove_patient_from_queue,
    get_ordered_queue,
    get_queue_stats,
    estimate_wait_time,
    get_queue_position,
)
from doctor_engine import (
    get_optimal_doctor,
    assign_doctor_to_patient,
    reassign_waiting_patients,
    auto_assign_next_patient,
    get_all_doctors,
    format_doctor_response,
)
from websocket_manager import (
    broadcast_queue_updated,
    broadcast_patient_status_changed,
    broadcast_doctor_status_changed,
    broadcast_emergency_added,
)

router = APIRouter(prefix="/staff", tags=["staff"])


async def _broadcast_full_update(db: AsyncSession):
    queue_data = await get_ordered_queue(db)
    stats = await get_queue_stats(db)
    await broadcast_queue_updated(queue_data, stats)


@router.post("/register-walkin", status_code=status.HTTP_201_CREATED)
async def register_walkin(payload: WalkInRequest, db: AsyncSession = Depends(get_db)):
    """
    Staff registers a walk-in patient. Same flow as patient self-registration.
    """
    token_number = await get_next_token()

    patient = Patient(
        token_number=token_number,
        name=payload.name,
        phone=payload.phone,
        reason=payload.reason,
        urgency=payload.urgency,
        status=PatientStatus.WAITING,
        created_at=datetime.now(timezone.utc),
    )
    db.add(patient)
    await db.flush()

    doctor = await get_optimal_doctor(db)
    if doctor:
        await assign_doctor_to_patient(db, patient, doctor)
        await db.flush()

    await db.commit()
    await db.refresh(patient)

    score = await add_patient_to_queue(patient)
    position = await get_queue_position(patient.id)
    if position == -1:
        position = await queue_length()
    wait_minutes = estimate_wait_time(position)

    event = EventLog(
        event_type="walkin_registered",
        reference_id=patient.id,
        metadata_json=json.dumps({"token": token_number, "by": "staff"}),
    )
    db.add(event)
    await db.commit()

    await _broadcast_full_update(db)

    return {
        "token_number": token_number,
        "patient_id": patient.id,
        "queue_position": position,
        "estimated_wait_minutes": wait_minutes,
        "message": f"Walk-in Token #{token_number:03d} registered successfully.",
    }


@router.post("/add-emergency", status_code=status.HTTP_201_CREATED)
async def add_emergency(payload: EmergencyRequest, db: AsyncSession = Depends(get_db)):
    """
    Staff adds an emergency patient — urgency forced to 10, placed at top of queue.
    """
    token_number = await get_next_token()

    patient = Patient(
        token_number=token_number,
        name=payload.name,
        phone=payload.phone,
        reason=payload.reason,
        urgency=10,
        status=PatientStatus.WAITING,
        created_at=datetime.now(timezone.utc),
    )
    db.add(patient)
    await db.flush()

    doctor = await get_optimal_doctor(db)
    if doctor:
        await assign_doctor_to_patient(db, patient, doctor)
        await db.flush()

    await db.commit()
    await db.refresh(patient)

    # Add with maximum score (will float to top)
    score = await add_patient_to_queue(patient)

    # Recalculate so all relative positions are correct
    await recalculate_queue(db)

    event = EventLog(
        event_type="emergency_added",
        reference_id=patient.id,
        metadata_json=json.dumps({"token": token_number, "urgency": 10}),
    )
    db.add(event)
    await db.commit()

    # Broadcast emergency event then full queue update
    await broadcast_emergency_added(patient.id, token_number, patient.name, 10)
    await _broadcast_full_update(db)

    return {
        "token_number": token_number,
        "patient_id": patient.id,
        "queue_position": 1,
        "message": f"Emergency Token #{token_number:03d} added — queue reshuffled.",
    }


@router.post("/mark-noshow/{patient_id}")
async def mark_noshow(patient_id: int, db: AsyncSession = Depends(get_db)):
    """
    Mark a patient as NO-SHOW.
    - Sets status to NO_SHOW
    - Removes from Redis queue
    - If patient was assigned to a doctor, frees the doctor slot
    - Broadcasts update
    """
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.status in (PatientStatus.COMPLETED, PatientStatus.NO_SHOW):
        raise HTTPException(status_code=400, detail=f"Patient already in terminal status: {patient.status}")

    old_status = patient.status
    patient.status = PatientStatus.NO_SHOW
    db.add(patient)

    # If patient was an active consultation, free the doctor
    if old_status == PatientStatus.IN_CONSULTATION and patient.assigned_doctor_id:
        doc_res = await db.execute(select(Doctor).where(Doctor.id == patient.assigned_doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if doctor and doctor.current_patient_id == patient.id:
            doctor.current_patient_id = None
            doctor.total_consulted_today += 1
            db.add(doctor)

    await db.commit()

    # Remove from Redis queue
    await remove_patient_from_queue(patient.id)

    event = EventLog(
        event_type="patient_noshow",
        reference_id=patient.id,
        metadata_json=json.dumps({"token": patient.token_number}),
    )
    db.add(event)
    await db.commit()

    await broadcast_patient_status_changed(patient.id, patient.token_number, "no_show", None)
    await _broadcast_full_update(db)

    return {"message": f"Token #{patient.token_number:03d} marked as NO-SHOW"}


@router.put("/toggle-doctor/{doctor_id}")
async def toggle_doctor(
    doctor_id: int,
    payload: ToggleDoctorRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Toggle doctor availability (is_active / is_on_break).
    - If going inactive → reassign their waiting patients to other doctors
    - If becoming active → auto-assign next patient from queue
    - Broadcasts doctor_status_changed
    """
    doc_result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = doc_result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    was_available = doctor.is_available

    if payload.is_active is not None:
        doctor.is_active = payload.is_active
    if payload.is_on_break is not None:
        doctor.is_on_break = payload.is_on_break

    db.add(doctor)
    await db.commit()

    now_available = doctor.is_available
    reassigned = []

    if was_available and not now_available:
        # Doctor went unavailable — reassign their waiting patients
        reassigned = await reassign_waiting_patients(db, doctor_id)
        # Also free their current consultation slot if on break
        if doctor.current_patient_id and doctor.is_on_break:
            doctor.current_patient_id = None
            db.add(doctor)
        await db.commit()

    elif not was_available and now_available:
        # Doctor became available — auto-assign next patient
        next_patient = await auto_assign_next_patient(db, doctor)
        if next_patient:
            await db.commit()

    event = EventLog(
        event_type="doctor_toggled",
        reference_id=doctor_id,
        metadata_json=json.dumps({
            "is_active": doctor.is_active,
            "is_on_break": doctor.is_on_break,
            "reassigned_patients": reassigned,
        }),
    )
    db.add(event)
    await db.commit()

    await broadcast_doctor_status_changed(
        doctor.id, doctor.name, doctor.is_active, doctor.is_on_break, doctor.current_patient_id
    )
    await _broadcast_full_update(db)

    return {
        "doctor_id": doctor_id,
        "doctor_name": doctor.name,
        "is_active": doctor.is_active,
        "is_on_break": doctor.is_on_break,
        "is_available": doctor.is_available,
        "reassigned_patients": reassigned,
        "message": f"{doctor.name} status updated successfully.",
    }


@router.post("/rebalance")
async def force_rebalance(db: AsyncSession = Depends(get_db)):
    """
    Force a full queue rebalance — recalculate all priority scores and re-emit.
    Useful after bulk changes.
    """
    await recalculate_queue(db)
    await _broadcast_full_update(db)

    queue_len = await queue_length()
    return {
        "message": f"Queue rebalanced successfully. {queue_len} patients re-scored.",
        "queue_length": queue_len,
    }


@router.get("/logs")
async def get_event_logs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Get recent event activity log."""
    result = await db.execute(
        select(EventLog)
        .order_by(EventLog.timestamp.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "event_type": log.event_type,
            "reference_id": log.reference_id,
            "metadata": log.metadata_json,
            "timestamp": log.timestamp.isoformat(),
        }
        for log in logs
    ]
