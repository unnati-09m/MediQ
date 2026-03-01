"""
schemas.py – Pydantic v2 schemas for MediQ
"""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator

from models import PatientStatus


# ─────────────────────────────── Patient Schemas ──────────────────────────────

class PatientRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=20)
    reason: str = Field(..., min_length=2, max_length=200)
    urgency: int = Field(default=5, ge=1, le=10)

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        return v.strip().replace(" ", "")


class PatientResponse(BaseModel):
    id: int
    token_number: int
    name: str
    phone: str
    reason: str
    urgency: int
    status: PatientStatus
    assigned_doctor_id: Optional[int] = None
    assigned_doctor_name: Optional[str] = None
    created_at: datetime
    consultation_start: Optional[datetime] = None
    consultation_end: Optional[datetime] = None
    queue_position: Optional[int] = None
    estimated_wait_minutes: Optional[int] = None

    model_config = {"from_attributes": True}


class RegistrationResponse(BaseModel):
    patient: PatientResponse
    token_number: int
    queue_position: int
    estimated_wait_minutes: int
    message: str


class QueueEntry(BaseModel):
    """Lightweight entry for the live queue display."""
    id: int
    token_number: int
    name: str
    reason: str
    urgency: int
    status: PatientStatus
    assigned_doctor_id: Optional[int]
    assigned_doctor_name: Optional[str] = None
    created_at: datetime
    queue_position: int
    estimated_wait_minutes: int
    priority_score: float

    model_config = {"from_attributes": True}


# ─────────────────────────────── Doctor Schemas ───────────────────────────────

class DoctorResponse(BaseModel):
    id: int
    name: str
    specialization: str
    is_active: bool
    is_on_break: bool
    is_available: bool
    current_patient_id: Optional[int] = None
    current_patient_token: Optional[int] = None
    total_consulted_today: int

    model_config = {"from_attributes": True}


class DoctorCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    specialization: str = Field(default="General Medicine", max_length=100)


class ToggleDoctorRequest(BaseModel):
    is_active: Optional[bool] = None
    is_on_break: Optional[bool] = None


# ────────────────────────── Doctor Action Schemas ─────────────────────────────

class StartConsultationRequest(BaseModel):
    patient_id: int


class FlagEmergencyRequest(BaseModel):
    patient_id: int


class SkipPatientRequest(BaseModel):
    patient_id: int


# ─────────────────────────────── Staff Schemas ────────────────────────────────

class WalkInRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(default="0000000000", max_length=20)
    reason: str = Field(..., min_length=2, max_length=200)
    urgency: int = Field(default=5, ge=1, le=10)


class EmergencyRequest(BaseModel):
    name: str = Field(default="Emergency Patient", max_length=120)
    phone: str = Field(default="0000000000", max_length=20)
    reason: str = Field(default="Emergency", max_length=200)


# ─────────────────────────────── Event Schemas ────────────────────────────────

class EventLogResponse(BaseModel):
    id: int
    event_type: str
    reference_id: Optional[int] = None
    metadata_json: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────── WebSocket Payloads ───────────────────────────────

class QueueSnapshot(BaseModel):
    """Lightweight entry for the live queue display."""
    queue: List[QueueEntry]
    doctors: List[DoctorResponse]
    stats: dict

    model_config = {"from_attributes": True}
