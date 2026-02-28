# MediQ Production Backend

A real-time intelligent clinic queue management system built with FastAPI, PostgreSQL, Redis, Socket.IO, Groq AI (Llama 3), and React (Vite).

---

## Quick Start

### First-Time Setup

```bash
# 1. Install system dependencies (macOS)
brew install redis postgresql@16

# 2. Start services
brew services start redis
brew services start postgresql@16

# 3. Create database
/opt/homebrew/opt/postgresql@16/bin/createuser -s mediq
/opt/homebrew/opt/postgresql@16/bin/createdb -U mediq mediq

# 4. Set up Python virtualenv & .env file
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# Create a .env file locally with GROQ_API_KEY for ML Triage:
# GROQ_API_KEY=your_groq_api_key_here

# 5. Install frontend dependencies
cd ..
npm install
```

### Running the System

**Terminal 1 — Backend API:**
```bash
./start.sh
# OR manually:
backend/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend (already running):**
```bash
npm run dev
```

The system auto-seeds 3 doctors and 5 demo patients on first startup.

---

## API Reference

### Health & Root
```bash
GET  /                       # System info
GET  /health                 # Redis + DB health check
GET  /docs                   # Interactive Swagger UI
```

### Patients
```bash
POST /api/patients/register  # Register new patient (generates token)
GET  /api/patients/queue     # Live priority-ordered queue
GET  /api/patients/stats     # Queue statistics
GET  /api/patients/{id}      # Single patient by ID
```

**Register Patient:**
```bash
curl -X POST http://localhost:8000/api/patients/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","phone":"9999999999","reason":"Fever / Cold","urgency":7}'
```

### Doctors
```bash
GET  /api/doctors                           # List all doctors
POST /api/doctors                           # Create doctor
POST /api/doctors/{id}/start-consultation   # Start consult {patient_id}
POST /api/doctors/{id}/complete-consultation # Complete consult
POST /api/doctors/{id}/skip-patient         # Skip {patient_id}
POST /api/doctors/{id}/flag-emergency       # Flag {patient_id} as emergency
```

**Start Consultation:**
```bash
curl -X POST http://localhost:8000/api/doctors/1/start-consultation \
  -H 'Content-Type: application/json' \
  -d '{"patient_id": 3}'
```

### Staff Control
```bash
POST /api/staff/register-walkin        # Walk-in patient registration
POST /api/staff/add-emergency          # Emergency patient (urgency=10)
POST /api/staff/mark-noshow/{id}       # Mark patient as no-show
PUT  /api/staff/toggle-doctor/{id}     # Toggle doctor availability
POST /api/staff/rebalance              # Force queue priority recalculation
GET  /api/staff/logs                   # Event activity log
```

---

## Priority Queue Formula

```
priority_score = (urgency × 0.6) + (wait_minutes × 0.3) + (doctor_load × 0.1)
```

Stored in Redis as `-score` (negative) so `ZRANGE` ascending = highest priority first.

---

## Socket.IO Events

Connect: `http://localhost:8000` (path: `/socket.io`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `queue_updated` | Server → Client | `{queue: [...], stats: {...}}` |
| `patient_status_changed` | Server → Client | `{patient_id, token_number, status, doctor_name}` |
| `doctor_status_changed` | Server → Client | `{doctor_id, doctor_name, is_active, is_on_break}` |
| `emergency_added` | Server → Client | `{patient_id, token_number, name, urgency}` |

---

## Project Structure

```
MediQ/
├── backend/
│   ├── main.py              ← FastAPI app + Socket.IO ASGI mount
│   ├── config.py            ← Settings (pydantic-settings)
│   ├── database.py          ← Async SQLAlchemy engine
│   ├── models.py            ← Patient, Doctor, EventLog ORM models
│   ├── schemas.py           ← Pydantic v2 request/response schemas
│   ├── redis_client.py      ← Redis client + ZSET helpers
│   ├── websocket_manager.py ← Socket.IO server + broadcast helpers
│   ├── queue_engine.py      ← Priority queue engine
│   ├── doctor_engine.py     ← Doctor assignment logic
│   ├── ml_engine/           ← AI Triage Engine
│       └── groq_engine.py   ← Groq LLM Integration (Llama 3)
│   ├── celery_tasks.py      ← Background task definitions
│   ├── seed.py              ← Initial data seed
│   ├── requirements.txt
│   └── routes/
│       ├── patients.py      ← /api/patients/*
│       ├── doctors.py       ← /api/doctors/*
│       └── staff.py         ← /api/staff/*
│
├── src/                   ← React (Vite) Frontend
│   ├── api.js               ← Axios client (baseURL: localhost:8000/api)
│   ├── socket.js            ← Socket.IO client singleton
│   └── pages/
│       ├── PatientRegistration.jsx  ← Wired to POST /api/patients/register
│       ├── LiveQueueDisplay.jsx     ← Real-time Socket.IO queue display
│       ├── DoctorDashboard.jsx      ← Doctor actions via API + Socket.IO
│       └── StaffDashboard.jsx       ← Staff control via API + Socket.IO
│
├── docker-compose.yml       ← PostgreSQL + Redis (for Docker users)
├── start.sh                 ← One-command startup script
└── package.json
```
