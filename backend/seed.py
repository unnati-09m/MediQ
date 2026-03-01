"""
seed.py – Seed initial data (doctors + demo patients) if DB is empty
"""
import json
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from database import AsyncSessionLocal
from models import Doctor, Patient, PatientStatus
from redis_client import get_next_token, add_to_queue
from queue_engine import compute_priority, add_patient_to_queue


SEED_DOCTORS = [
    {"name": "Dr. Priya Sharma", "specialization": "General Medicine"},
    {"name": "Dr. Anil Mehta", "specialization": "Cardiology"},
    {"name": "Dr. Sneha Rao", "specialization": "Pediatrics"},
]

SEED_PATIENTS = [
    {"name": "Rahul Verma", "phone": "9876543210", "reason": "General Checkup", "urgency": 3, "offset_minutes": 45},
    {"name": "Sunita Patel", "phone": "9876543211", "reason": "Follow-up / Prescription", "urgency": 5, "offset_minutes": 38},
    {"name": "Arjun Nair", "phone": "9876543212", "reason": "Fever / Cold", "urgency": 7, "offset_minutes": 30},
    {"name": "Meera Joshi", "phone": "9876543213", "reason": "Specialist Consult", "urgency": 4, "offset_minutes": 20},
    {"name": "Kiran Kumar", "phone": "9876543214", "reason": "General Checkup", "urgency": 2, "offset_minutes": 10},
]


async def seed_if_empty():
    """Run seeding only if the doctors table is empty."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Doctor).limit(1))
        existing = result.scalar_one_or_none()
        if existing:
            print("[Seed] Data already exists — skipping seed")
            return

        print("[Seed] Seeding initial data...")

        # 1. Create doctors
        doctors: list[Doctor] = []
        for d in SEED_DOCTORS:
            doctor = Doctor(
                name=d["name"],
                specialization=d["specialization"],
                is_active=True,
                is_on_break=False,
                total_consulted_today=0,
            )
            db.add(doctor)
            doctors.append(doctor)

        await db.flush()

        # Mark Dr. Sneha Rao as on break (matches the frontend mock)
        doctors[2].is_on_break = True
        db.add(doctors[2])
        await db.flush()

        # 2. Create demo patients
        now = datetime.now(timezone.utc)
        for i, p_data in enumerate(SEED_PATIENTS):
            token = await get_next_token()
            created = now - timedelta(minutes=p_data["offset_minutes"])
            patient = Patient(
                token_number=token,
                name=p_data["name"],
                phone=p_data["phone"],
                reason=p_data["reason"],
                urgency=p_data["urgency"],
                status=PatientStatus.WAITING,
                created_at=created,
            )
            # Assign first available doctor
            avail_doctor = next((d for d in doctors if d.is_active and not d.is_on_break), None)
            if avail_doctor:
                patient.assigned_doctor_id = avail_doctor.id

            db.add(patient)
            await db.flush()

            # Add to Redis queue
            score = compute_priority(patient.urgency, patient.created_at)
            await add_to_queue(patient.id, score)

        # Mark first patient as IN_CONSULTATION with Dr. Priya Sharma
        # (to match the UI's "NOW CALLING" state)
        result = await db.execute(select(Patient).where(Patient.token_number == 1))
        first_patient = result.scalar_one_or_none()
        if first_patient and doctors:
            first_patient.status = PatientStatus.IN_CONSULTATION
            first_patient.consultation_start = now - timedelta(minutes=12)
            first_patient.assigned_doctor_id = doctors[0].id
            doctors[0].current_patient_id = first_patient.id
            doctors[0].total_consulted_today = 3
            doctors[1].total_consulted_today = 2
            db.add(first_patient)
            db.add(doctors[0])
            db.add(doctors[1])
            # Remove from redis queue (in consultation, not waiting)
            from redis_client import remove_from_queue
            await remove_from_queue(first_patient.id)

        await db.commit()
        print(f"[Seed] Seeded {len(SEED_DOCTORS)} doctors and {len(SEED_PATIENTS)} patients ✓")
