"""
models.py – SQLAlchemy ORM models for MediQ
"""
import enum
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class PatientStatus(str, enum.Enum):
    WAITING = "waiting"
    IN_CONSULTATION = "in_consultation"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    token_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    urgency: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    status: Mapped[PatientStatus] = mapped_column(
        Enum(PatientStatus), nullable=False, default=PatientStatus.WAITING, index=True
    )
    assigned_doctor_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    consultation_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    consultation_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    assigned_doctor: Mapped[Optional["Doctor"]] = relationship(
        "Doctor", foreign_keys=[assigned_doctor_id], back_populates="assigned_patients"
    )

    def __repr__(self) -> str:
        return f"<Patient #{self.token_number} {self.name} [{self.status}]>"


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    specialization: Mapped[str] = mapped_column(String(100), nullable=False, default="General Medicine")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_on_break: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    current_patient_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="SET NULL"), nullable=True
    )
    total_consulted_today: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    assigned_patients: Mapped[List["Patient"]] = relationship(
        "Patient", foreign_keys="Patient.assigned_doctor_id", back_populates="assigned_doctor"
    )
    current_patient: Mapped[Optional["Patient"]] = relationship(
        "Patient", foreign_keys=[current_patient_id]
    )

    @property
    def is_available(self) -> bool:
        return self.is_active and not self.is_on_break and self.current_patient_id is None

    def __repr__(self) -> str:
        return f"<Doctor {self.name} [active={self.is_active}]>"


class EventLog(Base):
    __tablename__ = "event_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<EventLog {self.event_type} @ {self.timestamp}>"
