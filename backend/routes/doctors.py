"""
routes/doctors.py – Doctor listing and consultation action endpoints
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Patient, PatientStatus, Doctor, EventLog
from schemas import (
    DoctorResponse,
    DoctorCreateRequest,
    StartConsultationRequest,
    FlagEmergencyRequest,
    SkipPatientRequest,
)
from doctor_engine import (
    get_all_doctors,
    get_doctor_by_id,
    start_consultation,
    complete_consultation,
    auto_assign_next_patient,
    format_doctor_response,
)
from queue_engine import (
    remove_patient_from_queue,
    add_patient_to_queue,
    recalculate_queue,
    get_ordered_queue,
    get_queue_stats,
)
from websocket_manager import (
    broadcast_queue_updated,
    broadcast_patient_status_changed,
    broadcast_doctor_status_changed,
    broadcast_emergency_added,
)

router = APIRouter(prefix="/doctors", tags=["doctors"])


async def _broadcast_full_update(db: AsyncSession):
    queue_data = await get_ordered_queue(db)
    stats = await get_queue_stats(db)
    await broadcast_queue_updated(queue_data, stats)


@router.get("", response_model=list[DoctorResponse])
async def list_doctors(db: AsyncSession = Depends(get_db)):
    """List all doctors with current status."""
    doctors = await get_all_doctors(db)
    result_list = []
    for doctor in doctors:
        current_token = None
        if doctor.current_patient_id:
            res = await db.execute(
                select(Patient.token_number).where(Patient.id == doctor.current_patient_id)
            )
            current_token = res.scalar_one_or_none()

        result_list.append(DoctorResponse(
            id=doctor.id,
            name=doctor.name,
            specialization=doctor.specialization,
            is_active=doctor.is_active,
            is_on_break=doctor.is_on_break,
            is_available=doctor.is_available,
            current_patient_id=doctor.current_patient_id,
            current_patient_token=current_token,
            total_consulted_today=doctor.total_consulted_today,
        ))
    return result_list


@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor(payload: DoctorCreateRequest, db: AsyncSession = Depends(get_db)):
    """Create a new doctor (admin use)."""
    doctor = Doctor(name=payload.name, specialization=payload.specialization)
    db.add(doctor)
    await db.commit()
    await db.refresh(doctor)
    return DoctorResponse(
        id=doctor.id,
        name=doctor.name,
        specialization=doctor.specialization,
        is_active=doctor.is_active,
        is_on_break=doctor.is_on_break,
        is_available=doctor.is_available,
        current_patient_id=doctor.current_patient_id,
        current_patient_token=None,
        total_consulted_today=doctor.total_consulted_today,
    )


@router.post("/{doctor_id}/start-consultation")
async def start_consult(
    doctor_id: int,
    payload: StartConsultationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Doctor starts consultation with a patient.
    - Sets patient status to IN_CONSULTATION
    - Sets doctor.current_patient_id
    - Removes patient from Redis waiting queue
    - Broadcasts updates
    """
    doctor = await get_doctor_by_id(db, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    result = await db.execute(select(Patient).where(Patient.id == payload.patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.status != PatientStatus.WAITING:
        raise HTTPException(
            status_code=400,
            detail=f"Patient is not in WAITING status (current: {patient.status})"
        )

    # Update DB state
    await start_consultation(db, doctor, patient)
    await db.commit()

    # Remove from Redis queue
    await remove_patient_from_queue(patient.id)

    # Log event
    event = EventLog(
        event_type="consultation_started",
        reference_id=patient.id,
        metadata_json=json.dumps({"doctor_id": doctor_id, "token": patient.token_number}),
    )
    db.add(event)
    await db.commit()

    # Broadcast
    await broadcast_patient_status_changed(
        patient.id, patient.token_number, "in_consultation", doctor.name
    )
    await _broadcast_full_update(db)

    return {
        "message": f"Consultation started for Token #{patient.token_number:03d}",
        "patient_id": patient.id,
        "doctor_id": doctor_id,
        "consultation_start": patient.consultation_start.isoformat(),
    }


@router.post("/{doctor_id}/complete-consultation")
async def complete_consult(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Doctor marks consultation complete.
    - Sets patient COMPLETED
    - Frees doctor
    - Auto-assigns next waiting patient
    - Broadcasts update
    """
    doctor = await get_doctor_by_id(db, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if not doctor.current_patient_id:
        raise HTTPException(status_code=400, detail="Doctor has no current patient")

    result = await db.execute(select(Patient).where(Patient.id == doctor.current_patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Current patient not found")

    # Complete the consultation
    await complete_consultation(db, doctor, patient)
    await db.commit()

    # Log event
    event = EventLog(
        event_type="consultation_completed",
        reference_id=patient.id,
        metadata_json=json.dumps({
            "doctor_id": doctor_id,
            "token": patient.token_number,
            "total_consulted": doctor.total_consulted_today,
        }),
    )
    db.add(event)
    await db.commit()

    # Auto-assign next patient
    next_patient = await auto_assign_next_patient(db, doctor)
    if next_patient:
        await db.commit()

    # Broadcast
    await broadcast_patient_status_changed(patient.id, patient.token_number, "completed", None)
    await broadcast_doctor_status_changed(
        doctor.id, doctor.name, doctor.is_active, doctor.is_on_break, doctor.current_patient_id
    )
    await _broadcast_full_update(db)

    return {
        "message": f"Consultation completed for Token #{patient.token_number:03d}",
        "completed_patient_id": patient.id,
        "next_patient_id": next_patient.id if next_patient else None,
        "total_consulted_today": doctor.total_consulted_today,
    }


@router.post("/{doctor_id}/skip-patient")
async def skip_patient(
    doctor_id: int,
    payload: SkipPatientRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Skip/defer a patient — reinsert at lower priority (reduce urgency by 2, floor at 1).
    """
    result = await db.execute(select(Patient).where(Patient.id == payload.patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.status not in (PatientStatus.WAITING,):
        raise HTTPException(status_code=400, detail="Can only skip a WAITING patient")

    # Reduce effective urgency for priority (not stored permanently)
    # We add them back with reduced score (not updating DB urgency)
    from queue_engine import compute_priority, add_to_queue
    reduced_urgency = max(1, patient.urgency - 2)
    new_score = compute_priority(reduced_urgency, patient.created_at, 0.0)
    # Override with reduced score (below other patients of same urgency)
    new_score = max(0.1, new_score * 0.5)
    from redis_client import add_to_queue as redis_add
    await redis_add(patient.id, new_score)

    event = EventLog(
        event_type="patient_skipped",
        reference_id=patient.id,
        metadata_json=json.dumps({"doctor_id": doctor_id, "new_score": new_score}),
    )
    db.add(event)
    await db.commit()

    await _broadcast_full_update(db)
    return {"message": f"Token #{patient.token_number:03d} skipped and requeued at lower priority"}


@router.post("/{doctor_id}/flag-emergency")
async def flag_emergency(
    doctor_id: int,
    payload: FlagEmergencyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Flag a patient as emergency — set urgency to 10, recalculate queue, push to top.
    """
    result = await db.execute(select(Patient).where(Patient.id == payload.patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Set urgency to 10
    patient.urgency = 10
    db.add(patient)
    await db.commit()

    # Recompute entire queue
    await recalculate_queue(db)

    event = EventLog(
        event_type="emergency_flagged",
        reference_id=patient.id,
        metadata_json=json.dumps({"doctor_id": doctor_id, "token": patient.token_number}),
    )
    db.add(event)
    await db.commit()

    # Broadcast emergency event
    await broadcast_emergency_added(patient.id, patient.token_number, patient.name, 10)
    await _broadcast_full_update(db)

    return {"message": f"Token #{patient.token_number:03d} flagged as EMERGENCY — queue recalculated"}
