"""
doctor_engine.py – Doctor assignment and availability logic
"""
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import Doctor, Patient, PatientStatus


async def get_all_doctors(db: AsyncSession) -> List[Doctor]:
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.current_patient))
        .order_by(Doctor.id)
    )
    return result.scalars().all()


async def get_doctor_by_id(db: AsyncSession, doctor_id: int) -> Optional[Doctor]:
    result = await db.execute(
        select(Doctor)
        .where(Doctor.id == doctor_id)
        .options(selectinload(Doctor.current_patient))
    )
    return result.scalar_one_or_none()


async def get_optimal_doctor(db: AsyncSession) -> Optional[Doctor]:
    """
    Return the best available doctor to assign a new patient to.
    Criteria:
      1. is_active = True, is_on_break = False, current_patient_id = NULL
      2. Among those, prefer the one with fewest total_consulted_today (most rested)
    """
    result = await db.execute(
        select(Doctor)
        .where(
            Doctor.is_active == True,
            Doctor.is_on_break == False,
            Doctor.current_patient_id == None,
        )
        .order_by(Doctor.total_consulted_today.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def assign_doctor_to_patient(
    db: AsyncSession, patient: Patient, doctor: Doctor
) -> None:
    """Assign a doctor to a patient. Does NOT commit — caller is responsible."""
    patient.assigned_doctor_id = doctor.id
    db.add(patient)


async def free_doctor(db: AsyncSession, doctor: Doctor) -> None:
    """Free the doctor from their current patient. Does NOT commit."""
    doctor.current_patient_id = None
    db.add(doctor)


async def start_consultation(
    db: AsyncSession, doctor: Doctor, patient: Patient
) -> None:
    """
    Mark the consultation as started.
    Does NOT commit — caller is responsible.
    """
    doctor.current_patient_id = patient.id
    patient.status = PatientStatus.IN_CONSULTATION
    patient.consultation_start = datetime.now(timezone.utc)
    db.add(doctor)
    db.add(patient)


async def complete_consultation(
    db: AsyncSession, doctor: Doctor, patient: Patient
) -> None:
    """
    Mark the consultation as complete.
    Does NOT commit — caller is responsible.
    """
    patient.status = PatientStatus.COMPLETED
    patient.consultation_end = datetime.now(timezone.utc)
    doctor.total_consulted_today += 1
    doctor.current_patient_id = None
    db.add(doctor)
    db.add(patient)


async def auto_assign_next_patient(db: AsyncSession, doctor: Doctor) -> Optional[Patient]:
    """
    After a consultation ends, auto-assign the next highest-priority WAITING patient
    that is not yet assigned to any doctor.
    """
    from redis_client import get_queue_ordered, remove_from_queue

    ordered = await get_queue_ordered()
    if not ordered:
        return None

    for pid_str, _score in ordered:
        patient_id = int(pid_str)
        result = await db.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.status == PatientStatus.WAITING,
                Patient.assigned_doctor_id == None,
            )
        )
        patient = result.scalar_one_or_none()
        if patient:
            await assign_doctor_to_patient(db, patient, doctor)
            return patient

    return None


async def reassign_waiting_patients(db: AsyncSession, doctor_id: int) -> List[int]:
    """
    When a doctor goes inactive, reassign all their WAITING patients.
    Returns list of patient IDs that were reassigned.
    """
    result = await db.execute(
        select(Patient).where(
            Patient.assigned_doctor_id == doctor_id,
            Patient.status == PatientStatus.WAITING,
        )
    )
    patients = result.scalars().all()

    reassigned = []
    for patient in patients:
        other_doctor = await get_optimal_doctor(db)
        if other_doctor:
            patient.assigned_doctor_id = other_doctor.id
        else:
            patient.assigned_doctor_id = None
        db.add(patient)
        reassigned.append(patient.id)

    return reassigned


async def format_doctor_response(doctor: Doctor, db: AsyncSession) -> dict:
    """Build a serialisable doctor dict for API responses and WebSocket broadcasts."""
    current_token = None
    if doctor.current_patient_id:
        result = await db.execute(
            select(Patient.token_number).where(Patient.id == doctor.current_patient_id)
        )
        current_token = result.scalar_one_or_none()

    return {
        "id": doctor.id,
        "name": doctor.name,
        "specialization": doctor.specialization,
        "is_active": doctor.is_active,
        "is_on_break": doctor.is_on_break,
        "is_available": doctor.is_available,
        "current_patient_id": doctor.current_patient_id,
        "current_patient_token": current_token,
        "total_consulted_today": doctor.total_consulted_today,
    }
