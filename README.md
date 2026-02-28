# MediQ 🏥
### Intelligent real-time patient queue optimization for small and mid-sized clinics.

---

## 1. Problem Statement

### Problem Title
**The Waiting Room That Never Moves — Static Scheduling in Dynamic Clinical Environments**

### Problem Description
Small and mid-sized clinics form the backbone of primary healthcare, especially in densely populated regions where patient inflow is unpredictable and often exceeds planned capacity. Most clinics still rely on manual appointment books, basic spreadsheets, or first-come-first-serve systems. Doctors must juggle pre-booked appointments, walk-in patients, emergency cases, and last-minute cancellations — all while maintaining consultation quality. Consultation durations vary significantly based on case complexity, urgency, and patient history, making static scheduling systems inefficient and unrealistic in real-world clinical environments.

### Target Users 
- **Clinic Administrators & Reception Staff** — managing daily queue operations
- **Doctors & Practitioners** — handling consultations and time management
- **Patients** — seeking timely, transparent care with reduced waiting

### Existing Gaps
- Appointment slots are fixed and do not adapt to real-time variability
- Walk-in patients disrupt pre-planned schedules with no intelligent insertion logic
- No-shows and late arrivals create idle gaps or sudden congestion
- Urgent and emergency cases are not dynamically prioritized
- Doctors' actual consultation time is rarely modeled or factored into scheduling
- Manual rescheduling during peak hours leads to operational chaos

---

## 2. Problem Understanding & Approach

### Root Cause Analysis
The core failure is that existing clinic scheduling systems are **stateless** — they don't react to what's happening right now. They assume every patient arrives on time, every consultation takes the same duration, and no unexpected case will walk in. In reality, none of these assumptions hold. The absence of a real-time adaptive layer means small disruptions cascade into long delays throughout the day.

### Solution Strategy
MediQ addresses this with a **dynamic, event-driven queue engine** that continuously recalculates the optimal schedule based on live clinic state. Instead of a fixed slot system, MediQ models each patient as a prioritized entity and each doctor's schedule as a live resource — rebalancing both whenever a state change occurs (arrival, delay, no-show, emergency, or consultation overrun).

---

## 3. Proposed Solution

### Solution Overview
MediQ is a smart Patient Queue Optimization platform that combines real-time scheduling, urgency-based triage, and doctor workload balancing into a single unified system — designed specifically for the resource constraints of small and mid-sized clinics.

### Core Idea
Replace the static appointment slot model with a **priority queue + greedy scheduling engine** that continuously optimizes patient order based on urgency score, estimated consultation duration, doctor availability, and current wait time — recalculating automatically on every clinic event.

### Key Features

| Feature | Description |
|---|---|
| 🔴 Urgency Triage Engine | Patients scored 1–10 on urgency; critical cases auto-prioritized |
| 🔄 Real-Time Queue Rebalancing | Queue recalculates on every state change — no manual intervention |
| ⏱️ Smart Duration Estimation | Estimated consultation time based on case type and patient history |
| 👨‍⚕️ Doctor Workload Balancing | Tracks each doctor's load and distributes patients intelligently |
| 🚶 Walk-In Slot Injection | Walk-ins inserted without disrupting existing booked appointments |
| 📵 No-Show Auto-Recovery | Idle slots backfilled automatically when a patient doesn't show |
| 🚨 Emergency Override | Emergency cases jump to front with one-click override |
| 📊 Live Staff Dashboard | Clinic staff see full queue, estimated wait times, and doctor status |
| 🔔 Patient Notifications | SMS/app alerts keep patients informed of their real-time wait |

---

## 4. System Architecture

### High-Level Flow
```
User → Frontend → Backend → Queue Engine / ML Model → Database → Response
```

### Architecture Description
The patient or staff interacts with the **Frontend** (React.js). All actions — check-ins, walk-in registrations, emergency flags — are sent via REST API to the **Backend** (FastAPI). The backend feeds events into the **Queue Engine**, which uses a priority-queue algorithm and ML duration estimator to compute the optimal schedule. Updated queue state is persisted in **PostgreSQL** (appointments, patient records) and **Redis** (live queue state). The computed response — updated queue, wait times, notifications — flows back to the frontend in real time via WebSockets.

### Architecture Diagram
```
┌────────────────────────────────────────────────────────────────┐
│                        MediQ Platform                          │
│                                                                │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────┐   │
│  │   Patient   │     │    Staff /   │     │    Doctor      │   │
│  │   Portal    │     │  Reception   │     │   Dashboard    │   │
│  └──────┬──────┘     └──────┬───────┘     └───────┬────────┘   │
│         └──────────────────┼──────────────────────┘            │
│                            ▼                                   │
│                   ┌─────────────────┐                          │
│                   │   REST API /    │                          │
│                   │   WebSocket     │                          │
│                   └────────┬────────┘                          │
│                            ▼                                   │
│         ┌──────────────────────────────────┐                   │
│         │         Core Queue Engine        │                   │
│         │  ┌────────────┐ ┌─────────────┐  │                   │
│         │  │  Triage    │ │    Slot     │  │                   │
│         │  │  Scorer    │ │  Allocator  │  │                   │
│         │  └────────────┘ └─────────────┘  │                   │
│         │  ┌────────────┐ ┌─────────────┐  │                   │
│         │  │  Duration  │ │  Rebalancer │  │                   │
│         │  │  Estimator │ │   Module    │  │                   │
│         │  └────────────┘ └─────────────┘  │                   │
│         └──────────────┬───────────────────┘                   │
│                        ▼                                       │
│           ┌────────────────────────┐                           │
│           │  PostgreSQL  │  Redis  │                           │
│           │  (Records)   │ (Live Q)│                           │
│           └────────────────────────┘                           │
└────────────────────────────────────────────────────────────────┘
```
> *(Add system architecture diagram image here)*

---

## 5. Database Design

### ER Diagram
> *(Add ER diagram image here)*

### ER Diagram Description

**Entities & Relationships:**

- **Patient** — stores demographics, contact info, medical history flags, and urgency profile
- **Doctor** — stores availability windows, specialization, average consultation duration, and current load
- **Appointment** — links Patient ↔ Doctor with a scheduled time, estimated duration, status (booked / walk-in / completed / no-show / cancelled), and triage score
- **Queue** — live table tracking current position, assigned doctor, estimated wait time, and check-in timestamp
- **ConsultationLog** — records actual start/end time per appointment for duration model training

**Key Relationships:**
- A Patient can have many Appointments
- A Doctor can have many Appointments
- Each Appointment maps to one Queue entry
- ConsultationLog references each completed Appointment (1:1)

---

## 6. Dataset Selected

### Dataset Name
**Synthetic Clinical Scheduling Dataset + Public Healthcare Dataset**

### Source
- Synthetically generated using clinical scheduling parameters
- Reference: [UCI ML Repository — Patient Appointment No-Show Dataset (Kaggle)](https://www.kaggle.com/datasets/joniarroba/noshowappointments)

### Data Type
Structured / Tabular

### Selection Reason
No large-scale labeled dataset exists specifically for dynamic queue optimization in small clinics. The Kaggle No-Show dataset provides real-world appointment patterns, no-show rates, and patient demographics. Synthetic data is layered on top to simulate walk-ins, urgency events, consultation durations, and overruns.

### Preprocessing Steps
1. Remove duplicate and null appointment records
2. Encode categorical fields (gender, diagnosis category, day of week)
3. Engineer features: time-since-scheduled, urgency score, historical no-show rate per patient
4. Normalize consultation duration values
5. Augment with synthetic walk-in and emergency event rows
6. Split into train / validation / test sets (70 / 15 / 15)

---

## 7. Model Selected

### Model Name
**Gradient Boosting Regressor (XGBoost)** — Consultation Duration Estimation
**Priority Queue Algorithm** — Real-Time Dynamic Scheduling

### Selection Reasoning
XGBoost was selected for duration estimation because the feature set (case type, patient age, history flags, day/time) contains non-linear relationships that tree-based models capture well. It also handles missing values natively and is fast at inference — critical for a real-time system. The Priority Queue algorithm drives the scheduling engine because the core problem is a constrained ordering problem, not a prediction task. A min-heap priority queue with dynamic reweighting provides O(log n) insertion and extraction, suitable for clinic-scale real-time operations.

### Alternatives Considered
- **Random Forest Regressor** — considered for duration estimation; slightly lower accuracy than XGBoost on this feature set
- **Linear Regression** — too simple; poor fit for non-linear consultation time patterns
- **Rule-Based Triage Only** — no learning component; cannot adapt to per-clinic patterns over time
- **Deep Learning (LSTM)** — overkill for current dataset size; XGBoost outperforms with less data and faster inference

### Evaluation Metrics

| Metric | Purpose |
|---|---|
| MAE (Mean Absolute Error) | Measure duration prediction accuracy in minutes |
| RMSE | Penalize large prediction errors more heavily |
| Queue Wait Time Reduction (%) | End-to-end system effectiveness |
| Average Doctor Idle Time (%) | Efficiency of slot utilization |
| Patient Throughput per Hour | Overall clinic capacity improvement |

---

## 8. Technology Stack

### Frontend
- React.js — component-based UI
- TailwindCSS — styling
- Socket.IO Client — real-time queue updates

### Backend
- Python FastAPI — REST API + WebSocket server
- Celery — async task processing for queue rebalancing
- Socket.IO — real-time event broadcasting

### ML / AI
- XGBoost — consultation duration estimation
- Scikit-learn — preprocessing pipeline
- Pandas / NumPy — data processing

### Database
- PostgreSQL — persistent data (patients, doctors, appointments)
- Redis — live queue state and session cache

### Deployment
- Docker + Docker Compose — containerization
- AWS EC2 / Railway — cloud hosting
- Nginx — reverse proxy

---

## 9. API Documentation & Testing

### API Endpoints List

**Endpoint 1: Register / Check-In Patient**
```
POST /api/v1/patients/checkin
Body:     { patient_id, visit_reason, urgency_self_report, is_walkin }
Response: { queue_position, estimated_wait_minutes, assigned_doctor }
```

**Endpoint 2: Get Live Queue Status**
```
GET  /api/v1/queue/live
Response: { queue: [ { patient_id, name, triage_score, position, eta } ] }
```

**Endpoint 3: Trigger Queue Rebalance**
```
POST /api/v1/queue/rebalance
Body:     { event_type: "no_show" | "emergency" | "overrun" | "cancellation", patient_id }
Response: { updated_queue, affected_patients_notified }
```

**Endpoint 4: Doctor Availability Update**
```
PATCH /api/v1/doctors/{doctor_id}/availability
Body:     { status: "available" | "in_consultation" | "break", estimated_free_at }
Response: { queue_rebalanced: true }
```

**Endpoint 5: Estimate Consultation Duration**
```
POST /api/v1/model/estimate-duration
Body:     { patient_age, visit_reason, chronic_conditions, is_followup }
Response: { estimated_duration_minutes, confidence_score }
```

### API Testing Screenshots
> *(Add Postman / Thunder Client screenshots here)*

---

## 10. Module-wise Development & Deliverables

### Checkpoint 1: Research & Planning
**Deliverables:**
- Problem statement finalization and user persona mapping
- System architecture diagram and data flow design
- Database schema (ER diagram)
- Technology stack selection and justification
- Project repository initialized with folder structure

### Checkpoint 2: Backend Development
**Deliverables:**
- FastAPI project setup with modular routing
- PostgreSQL schema implemented (Patient, Doctor, Appointment, Queue, ConsultationLog tables)
- Redis integration for live queue state
- Core CRUD APIs for patients, doctors, and appointments
- Authentication middleware (JWT)

### Checkpoint 3: Frontend Development
**Deliverables:**
- React project scaffolded with TailwindCSS
- Patient check-in portal (web + mobile-responsive)
- Staff dashboard with live queue view
- Doctor view with consultation controls
- WebSocket integration for real-time queue updates

### Checkpoint 4: Model Training
**Deliverables:**
- Dataset sourced, cleaned, and preprocessed
- Feature engineering completed (urgency score, historical duration, no-show risk)
- XGBoost model trained and evaluated
- Model serialized and versioned (joblib / pickle)
- Evaluation report with MAE and RMSE metrics

### Checkpoint 5: Model Integration
**Deliverables:**
- Duration estimation API endpoint connected to trained model
- Queue Engine integrated with triage scorer and slot allocator
- End-to-end flow tested: patient check-in → triage → slot assignment → notification
- Emergency override and no-show recovery flows tested
- Celery tasks for async rebalancing operational

### Checkpoint 6: Deployment
**Deliverables:**
- Dockerized backend, frontend, Redis, and PostgreSQL services
- Docker Compose configuration for local and production environments
- Deployed to cloud (AWS EC2 / Railway)
- Environment variables secured via `.env`
- Live demo URL active and tested

---

## 11. End-to-End Workflow

1. **Patient Arrives** — Patient checks in via the MediQ portal (self-service kiosk or reception tablet), entering their visit reason and any self-reported urgency.
2. **Triage Scoring** — MediQ's Triage Engine assigns a priority score (1–10) based on reported symptoms, patient history, age, and current wait time.
3. **Duration Estimation** — The XGBoost model predicts the estimated consultation duration for this patient based on their profile and visit type.
4. **Queue Insertion** — The Slot Allocator inserts the patient into the priority queue at the optimal position, balancing urgency against fairness to waiting patients.
5. **Doctor Assignment** — The Workload Balancer assigns the patient to the most available doctor, factoring in specialization and current session load.
6. **Real-Time Notification** — The patient receives an SMS/app notification with their estimated wait time and queue position.
7. **Event Handling** — If a state change occurs (no-show, emergency arrival, consultation overrun), the Rebalancer recalculates the entire queue and pushes updated wait times to all affected patients automatically.

---

## 12. Demo & Video

- **Live Demo Link:** `https://mediq-demo.vercel.app` *(update after deployment)*
- **Demo Video Link:** *(Add link after recording)*
- **GitHub Repository:** `https://github.com/your-org/mediq`

---

## 13. Hackathon Deliverables Summary

- ✅ Fully functional MediQ web application (patient portal + staff dashboard + doctor view)
- ✅ Trained XGBoost model for consultation duration estimation
- ✅ Real-time queue engine with triage scoring, emergency override, and no-show recovery
- ✅ REST API with documented endpoints (Postman collection included)
- ✅ Dockerized deployment with PostgreSQL + Redis
- ✅ GitHub repository with clean commit history and this README

---

## 14. Team Roles & Responsibilities

| Member Name | Role | Responsibilities |
|---|---|---|
| *(Name)* | Team Lead & Backend Engineer | FastAPI setup, Queue Engine, Database design, API development |
| *(Name)* | ML Engineer | Dataset preprocessing, XGBoost model training, duration estimation API |
| *(Name)* | Frontend Developer | React UI, Staff Dashboard, Patient Portal, WebSocket integration |
| *(Name)* | DevOps & Integration | Docker, deployment, API testing, end-to-end integration |

---

## 15. Future Scope & Scalability

### Short-Term
- ML-based no-show prediction to proactively backfill low-risk slots
- Patient self-service QR code check-in at clinic entrance
- Multi-doctor, multi-room support for larger clinic setups
- Basic analytics dashboard for daily/weekly clinic performance reports

### Long-Term
- Deep learning model trained on clinic-specific EHR data for hyper-accurate duration prediction
- Integration with existing clinic management platforms (Practo, eHospital, mFine)
- Mobile app for patients with live queue tracking and appointment booking
- Federated learning across multiple clinics for shared model improvement without data sharing
- Government health system integration for public clinic deployments
- Voice-based patient registration for low-literacy or elderly populations

---

## 16. Known Limitations

- Duration estimation model accuracy depends on historical consultation data — new clinics with no prior data will rely on cold-start defaults until sufficient records are collected
- The current system assumes a single-location clinic; multi-branch deployments require additional architectural changes
- Emergency triage scoring relies on self-reported symptoms, which may not always accurately reflect clinical severity
- Real-time notifications require the patient to have a registered phone number or the MediQ app installed

---

## 17. Impact

- **For Patients** — Average waiting time reduced from 45–60 minutes to an estimated 15–25 minutes through smarter queue ordering and real-time updates, improving satisfaction and trust in the clinic
- **For Doctors** — Reduced schedule overruns and idle time leads to lower fatigue, better consultation quality, and the ability to serve more patients per day without burnout
- **For Clinic Staff** — Manual queue management replaced by an automated system, freeing reception staff from constant firefighting to focus on patient experience
- **For Healthcare Access** — Faster throughput means more patients can be seen per day in the same clinic with the same resources — directly improving primary care access in high-demand, underserved communities
- **For Clinic Revenue** — Reduced idle slots from no-shows and improved daily patient volume translates to better clinic financial health without any additional infrastructure investment

---

> Built with ❤️ at Hackathon 2025 — *because no patient should wait forever, and no doctor should burn out from chaos.*
