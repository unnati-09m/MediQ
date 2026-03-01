"""
queue_engine.py – Priority queue engine using Redis ZSET
Priority formula: score = (urgency * 0.6) + (wait_minutes * 0.3) + (doctor_load * 0.1)
Stored as -score so ZRANGE (ascending) returns highest priority first.
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import Patient, PatientStatus, Doctor
from redis_client import (
    add_to_queue,
    remove_from_queue,
    get_queue_ordered,
    get_queue_position,
    queue_length,
)

# Average consultation time in minutes (used for wait time estimation)
AVG_CONSULT_MINUTES = 12


def compute_priority(
    urgency: int,
    created_at: datetime,
    doctor_load: float = 0.0,
) -> float:
    """
    Compute priority score for a patient.

    Higher score → higher priority (comes first in queue).

    Args:
        urgency: 1–10 urgency score
        created_at: patient registration time
        doctor_load: inverse load factor (0.0 = high load, 1.0 = no load)
    """
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    wait_minutes = (now - created_at).total_seconds() / 60.0
    score = (urgency * 0.6) + (wait_minutes * 0.3) + (doctor_load * 0.1)
    return round(score, 4)


def estimate_wait_time(queue_position: int, avg_consult: int = AVG_CONSULT_MINUTES) -> int:
    """
    Estimate wait time in minutes based on queue position.
    Positions ahead × average consultation time.
    """
    if queue_position <= 0:
        return 0
    return max(1, (queue_position - 1) * avg_consult)


async def add_patient_to_queue(patient: Patient, doctor_load: float = 0.0) -> float:
    """Compute priority score and add patient to Redis ZSET."""
    score = compute_priority(patient.urgency, patient.created_at, doctor_load)
    await add_to_queue(patient.id, score)
    return score


async def remove_patient_from_queue(patient_id: int) -> None:
    """Remove patient from Redis ZSET."""
    await remove_from_queue(patient_id)


async def get_ordered_queue(db: AsyncSession) -> List[dict]:
    """
    Fetch the priority-ordered queue from Redis and join with DB for full patient data.
    Returns list of patient dicts enriched with position and estimated wait.
    """
    ordered = await get_queue_ordered()  # [(patient_id_str, neg_score), ...]
    if not ordered:
        return []

    # Build id → position + score map
    id_position: dict[int, tuple[int, float]] = {}
    for rank, (pid_str, neg_score) in enumerate(ordered):
        id_position[int(pid_str)] = (rank + 1, -neg_score)  # convert back to positive score

    patient_ids = list(id_position.keys())

    # Single batched DB query
    result = await db.execute(
        select(Patient)
        .where(Patient.id.in_(patient_ids))
        .options(selectinload(Patient.assigned_doctor))
    )
    patients = result.scalars().all()

    queue_entries: list[dict] = []
    for patient in patients:
        pos, score = id_position.get(patient.id, (999, 0.0))
        wait = estimate_wait_time(pos)
        queue_entries.append({
            "id": patient.id,
            "token_number": patient.token_number,
            "name": patient.name,
            "reason": patient.reason,
            "urgency": patient.urgency,
            "status": patient.status.value,
            "assigned_doctor_id": patient.assigned_doctor_id,
            "assigned_doctor_name": patient.assigned_doctor.name if patient.assigned_doctor else None,
            "created_at": patient.created_at.isoformat(),
            "queue_position": pos,
            "estimated_wait_minutes": wait,
            "priority_score": score,
        })

    # Sort by queue position
    queue_entries.sort(key=lambda e: e["queue_position"])
    return queue_entries


async def recalculate_queue(db: AsyncSession) -> None:
    """
    Recalculate priority scores for ALL waiting patients and update Redis ZSET.
    Called after any event that changes priorities (emergency added, skip, etc.)
    """
    # Fetch all waiting patients
    result = await db.execute(
        select(Patient).where(Patient.status == PatientStatus.WAITING)
    )
    waiting_patients = result.scalars().all()

    # Fetch doctor loads: {doctor_id: patients_assigned_count}
    doc_result = await db.execute(select(Doctor))
    doctors = doc_result.scalars().all()

    # Doctor load factor: fewer patients = higher load factor (i.e., more capacity)
    # We use total_consulted_today as a proxy (more consulted = more experienced/available)
    max_consulted = max((d.total_consulted_today for d in doctors), default=1) or 1

    # Re-score each waiting patient
    for patient in waiting_patients:
        if patient.assigned_doctor_id:
            # Find doctor's load factor: higher consulted = smaller load factor here
            doctor = next((d for d in doctors if d.id == patient.assigned_doctor_id), None)
            doctor_load = 1.0 - (doctor.total_consulted_today / max_consulted) if doctor else 0.0
        else:
            doctor_load = 0.0

        score = compute_priority(patient.urgency, patient.created_at, doctor_load)
        await add_to_queue(patient.id, score)


async def get_queue_stats(db: AsyncSession) -> dict:
    """Compute live stats for the queue."""
    from sqlalchemy import func as sqlfunc
    from models import PatientStatus

    # Count by status
    result = await db.execute(
        select(Patient.status, sqlfunc.count(Patient.id))
        .group_by(Patient.status)
    )
    counts = {row[0].value: row[1] for row in result}

    waiting = counts.get("waiting", 0)
    in_consultation = counts.get("in_consultation", 0)
    completed = counts.get("completed", 0)
    no_show = counts.get("no_show", 0)

    # Average wait time for waiting patients
    q_len = await queue_length()
    avg_wait = estimate_wait_time(max(1, q_len // 2)) if q_len > 0 else 0

    return {
        "in_queue": waiting,
        "in_consultation": in_consultation,
        "completed_today": completed,
        "no_shows_today": no_show,
        "avg_wait_minutes": avg_wait,
        "total_today": waiting + in_consultation + completed + no_show,
    }
