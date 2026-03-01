# 🏥 MediQ – Smart Clinic Queue Management System

> 🚀 Built at OverClock 24 Hours Hackathon  
> 👨‍💻 Team: Error 404  

MediQ is a real-time smart clinic queue management system designed to reduce long waiting times in small and mid-sized clinics.

As first-year engineering students, we wanted to build a practical solution that solves a real-world healthcare problem using AI, real-time systems, and database concepts.

---

# 🌐 Live Deployment

### 🔹 Frontend (Vercel)
👉 https://mediq-pink.vercel.app/

### 🔹 Backend API (Render)
👉 https://mediq-b06o.onrender.com/docs#/

You can explore all backend APIs using the Swagger documentation link above.


### 🔹 Demo video
👉 https://drive.google.com/file/d/1S57-DnymQ86RMp0mxOzr9ZmLpnDd4n_d/view?usp=sharing

---

# 📌 Problem Statement

In many clinics:

- Patients are handled on a first-come-first-serve basis
- Emergency cases are not properly prioritized
- Doctors may get overloaded
- No real-time queue visibility
- Manual record handling

This leads to long waiting times and poor management.

---

# 💡 Our Solution

MediQ introduces:

- 🧠 AI-powered symptom triage (Groq – Llama 3)
- ⚡ Smart priority-based queue system
- 📡 Real-time updates using Socket.IO
- 👨‍⚕️ Doctor workload balancing
- 🧑‍💼 Staff control dashboard
- 📊 Activity logging system

Instead of a normal queue, we built a dynamic priority engine.

---

# 🧠 Priority Algorithm

We use:

priority_score = (urgency × 0.6) + (wait_minutes × 0.3) + (doctor_load × 0.1)


This ensures:

- Emergency patients move first
- Waiting time increases priority gradually
- Doctors are balanced equally

We store this in Redis using Sorted Sets (ZSET) for high performance.

---

# 🖥 Portal Screenshots

## 1️⃣ Patient Registration Page
<img width="1512" height="823" alt="Screenshot 2026-03-01 at 9 55 00 AM" src="https://github.com/user-attachments/assets/793190b6-dd7b-4f42-b677-8a5244330bd7" />


---

## 2️⃣ Token Confirmation Page
<img width="1507" height="821" alt="Screenshot 2026-03-01 at 9 57 09 AM" src="https://github.com/user-attachments/assets/cbfe5e44-65f3-4e43-b347-94ea6619c33c" />


---

## 3️⃣ Live Queue Display
<img width="1512" height="823" alt="Screenshot 2026-03-01 at 9 57 33 AM" src="https://github.com/user-attachments/assets/031b9c6a-038d-4525-a5a8-8850b53b0767" />


---

## 4️⃣ Doctor Dashboard
<img width="1508" height="822" alt="Screenshot 2026-03-01 at 9 57 38 AM" src="https://github.com/user-attachments/assets/dea66904-26b1-497b-9639-1a73916d16eb" />


---

## 5️⃣ Staff Control Centre
<img width="1512" height="824" alt="Screenshot 2026-03-01 at 9 57 43 AM" src="https://github.com/user-attachments/assets/387c61f5-55b2-48b5-b4f8-e70d95b85c67" />


---

# 🏗 System Architecture

Frontend (React + Vite)  
⬇  
FastAPI Backend  
⬇  
PostgreSQL (Database)  
⬇  
Redis (Priority Queue)  
⬇  
Socket.IO (Real-time Communication)  
⬇  
Groq AI (Llama 3)

---

# 🛠 Technologies Used

## 🔹 Backend
- FastAPI
- PostgreSQL
- Async SQLAlchemy
- Redis
- Socket.IO
- Celery
- Groq API (Llama 3)

## 🔹 Frontend
- React (Vite)
- Axios
- Socket.IO Client

## 🔹 Deployment
- Vercel (Frontend)
- Render (Backend)
- PostgreSQL
- Redis

---

# ⚙️ How to Run Locally

## 1️⃣ Install Dependencies (macOS)

```bash
brew install redis postgresql@16
brew services start redis
brew services start postgresql@16

2️⃣ Create Database

createuser -s mediq
createdb -U mediq mediq

3️⃣ Backend Setup
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt

Create .env file inside backend folder:

GROQ_API_KEY=your_groq_api_key_here

4️⃣ Run Backend
./start.sh

OR

backend/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
5️⃣ Run Frontend
npm install
npm run dev

On first startup, the system auto-seeds:

3 doctors

5 demo patients

📡 API Endpoints
Patients

POST /api/patients/register

GET /api/patients/queue

GET /api/patients/stats

Doctors

POST /api/doctors/{id}/start-consultation

POST /api/doctors/{id}/complete-consultation

POST /api/doctors/{id}/skip-patient

POST /api/doctors/{id}/flag-emergency

Staff

POST /api/staff/register-walkin

POST /api/staff/add-emergency

POST /api/staff/rebalance

GET /api/staff/logs

Swagger Docs:

https://mediq-b06o.onrender.com/docs#/
📂 Project Structure
MediQ/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── redis_client.py
│   ├── websocket_manager.py
│   ├── queue_engine.py
│   ├── doctor_engine.py
│   ├── ml_engine/
│   │   └── groq_engine.py
│   ├── celery_tasks.py
│   ├── seed.py
│   ├── requirements.txt
│   └── routes/
│       ├── patients.py
│       ├── doctors.py
│       └── staff.py
│
├── src/
│   ├── api.js
│   ├── socket.js
│   └── pages/
│       ├── PatientRegistration.jsx
│       ├── LiveQueueDisplay.jsx
│       ├── DoctorDashboard.jsx
│       └── StaffDashboard.jsx
│
├── docker-compose.yml
├── start.sh
└── package.json
🚀 Why This Project Stands Out

Solves real healthcare problem

AI integration

Real-time queue system

Optimized using Redis

Full-stack architecture

Deployed live

🔮 Future Improvements

Mobile App version

Advanced ML health prediction

Cloud scaling

Multi-clinic support

SMS notifications

Live Website: https://mediq-pink.vercel.app/

👥 Team – Error 404

Dheeraj Jadhav - Queue Algorithm & Integration

Unnati Mehatkar - Frontend & UI

Sahil Shingate - Backend & Database
