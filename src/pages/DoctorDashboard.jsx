import { useState, useEffect, useRef } from 'react'
import api from '../api'
import socket from '../socket'

const HOURLY_DATA = [2, 3, 5, 4, 6, 7, 5, 4, 3]
const HOURS = ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM']

function UrgencyBadge({ urgency }) {
    if (urgency >= 8) return <span className="badge badge-red">Critical</span>
    if (urgency >= 5) return <span className="badge badge-amber">Urgent</span>
    return <span className="badge badge-teal">Normal</span>
}

function UrgencyGauge({ value }) {
    const angle = -90 + (value / 10) * 180
    const color = value >= 8 ? '#FF4757' : value >= 5 ? '#FFB020' : '#00D4BD'
    return (
        <div style={{ position: 'relative', width: 140, height: 80, margin: '0 auto' }}>
            <svg width="140" height="80" viewBox="0 0 140 80">
                <path d="M10 75 A60 60 0 0 1 130 75" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round" />
                <path d="M10 75 A60 60 0 0 1 130 75" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray="188" strokeDashoffset={`${188 - (188 * value / 10)}`}
                    style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s' }} />
                <g transform={`rotate(${angle}, 70, 75)`}>
                    <line x1="70" y1="75" x2="70" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round" />
                    <circle cx="70" cy="75" r="5" fill={color} />
                </g>
                <text x="70" y="72" textAnchor="middle" fill={color} fontFamily="Orbitron, monospace" fontSize="18" fontWeight="700">{value}</text>
            </svg>
            <div style={{ textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginTop: -8 }}>/ 10</div>
        </div>
    )
}

function ConsultTimer({ startTime }) {
    const [secs, setSecs] = useState(0)
    const ref = useRef(null)
    useEffect(() => {
        if (!startTime) return
        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
            setSecs(elapsed)
        }
        updateTimer()
        ref.current = setInterval(updateTimer, 1000)
        return () => clearInterval(ref.current)
    }, [startTime])
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    const pad = n => String(n).padStart(2, '0')
    return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Consultation Time</div>
            <div className="orbitron-timer">{pad(h)}:{pad(m)}:{pad(s)}</div>
        </div>
    )
}

export default function DoctorDashboard() {
    const [queue, setQueue] = useState([])
    const [doctors, setDoctors] = useState([])
    const [activePatientId, setActivePatientId] = useState(null)
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState({})
    const [error, setError] = useState(null)
    const [stats, setStats] = useState({ completed_today: 0 })

    // Default to doctor 1 (Dr. Priya Sharma) — in a real app this would be auth-based
    const DOCTOR_ID = 1

    const activePatient = queue.find(p => p.id === activePatientId) ||
        queue.find(p => p.status === 'in_consultation') ||
        null

    async function fetchQueue() {
        try {
            const [qRes, dRes, sRes] = await Promise.all([
                api.get('/patients/queue'),
                api.get('/doctors'),
                api.get('/patients/stats'),
            ])
            setQueue(qRes.data)
            setDoctors(dRes.data)
            setStats(sRes.data)
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
        }
    }

    useEffect(() => {
        fetchQueue()

        const onQueueUpdated = (data) => {
            if (data.queue) setQueue(data.queue)
            if (data.stats) setStats(data.stats)
        }
        socket.on('queue_updated', onQueueUpdated)
        socket.on('patient_status_changed', fetchQueue)
        socket.on('doctor_status_changed', fetchQueue)

        const pollInterval = setInterval(fetchQueue, 20000)

        return () => {
            socket.off('queue_updated', onQueueUpdated)
            socket.off('patient_status_changed', fetchQueue)
            socket.off('doctor_status_changed', fetchQueue)
            clearInterval(pollInterval)
        }
    }, [])

    async function handleStartConsult(patient) {
        setLoading(l => ({ ...l, [`start_${patient.id}`]: true }))
        setError(null)
        try {
            await api.post(`/doctors/${DOCTOR_ID}/start-consultation`, { patient_id: patient.id })
            setActivePatientId(patient.id)
            await fetchQueue()
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
            setError(error.message);
        } finally {
            setLoading(l => ({ ...l, [`start_${patient.id}`]: false }))
        }
    }

    async function handleComplete() {
        setLoading(l => ({ ...l, complete: true }))
        setError(null)
        try {
            await api.post(`/doctors/${DOCTOR_ID}/complete-consultation`)
            setActivePatientId(null)
            setNotes('')
            await fetchQueue()
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
            setError(error.message);
        } finally {
            setLoading(l => ({ ...l, complete: false }))
        }
    }

    async function handleSkip(patient) {
        setLoading(l => ({ ...l, [`skip_${patient.id}`]: true }))
        try {
            await api.post(`/doctors/${DOCTOR_ID}/skip-patient`, { patient_id: patient.id })
            await fetchQueue()
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
            setError(error.message);
        } finally {
            setLoading(l => ({ ...l, [`skip_${patient.id}`]: false }))
        }
    }

    async function handleFlagEmergency(patient) {
        setLoading(l => ({ ...l, [`emergency_${patient.id}`]: true }))
        try {
            await api.post(`/doctors/${DOCTOR_ID}/flag-emergency`, { patient_id: patient.id })
            await fetchQueue()
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
            setError(error.message);
        } finally {
            setLoading(l => ({ ...l, [`emergency_${patient.id}`]: false }))
        }
    }

    const waitingQueue = queue.filter(p => p.status === 'waiting')
    const doctor = doctors.find(d => d.id === DOCTOR_ID)
    const maxBar = Math.max(...HOURLY_DATA)

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* HEADER */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,212,189,0.12)', background: 'rgba(10,22,40,0.9)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', marginBottom: 2 }}>
                            Good evening, {doctor?.name || 'Dr. Priya Sharma'} 👋
                        </h1>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })} · {doctor?.specialization || 'General Medicine'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {[['Patients Seen', stats.completed_today || 0, 'teal'], ['In Queue', waitingQueue.length, 'amber'], ['Active', activePatient ? 1 : 0, 'blue']].map(([l, v, c]) => (
                            <div key={l} style={{ textAlign: 'center', background: 'rgba(10,22,40,0.8)', border: `1px solid rgba(${c === 'teal' ? '0,212,189' : c === 'blue' ? '61,127,255' : '255,176,32'},0.2)`, borderRadius: 10, padding: '10px 20px' }}>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 20, fontWeight: 700, color: `var(--accent-${c})` }}>{v}</div>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
                            </div>
                        ))}
                    </div>
                </div>
                {error && (
                    <div style={{ marginTop: 8, padding: '8px 14px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 6, fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent-red)' }}>
                        ⚠ {error}
                    </div>
                )}
            </div>

            {/* 3 COLUMNS */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 300px', overflow: 'hidden' }}>
                {/* LEFT — QUEUE */}
                <div style={{ borderRight: '1px solid rgba(0,212,189,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 16px 8px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        Queue ({waitingQueue.length})
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
                        {/* In Consultation row */}
                        {activePatient && activePatient.status === 'in_consultation' && (
                            <div className="patient-card active-patient">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 18, fontWeight: 700, color: 'var(--accent-teal)' }}>#{String(activePatient.token_number).padStart(3, '0')}</div>
                                    <UrgencyBadge urgency={activePatient.urgency} />
                                </div>
                                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>{activePatient.name}</div>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{activePatient.reason}</div>
                                <span className="badge badge-teal" style={{ fontSize: 10 }}>● IN CONSULTATION</span>
                            </div>
                        )}
                        {/* Waiting patients */}
                        {waitingQueue.map((p, i) => (
                            <div key={p.id} className="patient-card" onClick={() => handleStartConsult(p)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 18, fontWeight: 700, color: 'var(--text-muted)' }}>#{String(p.token_number).padStart(3, '0')}</div>
                                    <UrgencyBadge urgency={p.urgency} />
                                </div>
                                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>{p.name}</div>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{p.reason} · ~{p.estimated_wait_minutes} min</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn-teal" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 11 }}
                                        disabled={loading[`start_${p.id}`] || !!activePatient}
                                        onClick={e => { e.stopPropagation(); handleStartConsult(p) }}>
                                        {loading[`start_${p.id}`] ? '...' : 'START'}
                                    </button>
                                    <button className="btn-outline" style={{ padding: '6px 8px', borderRadius: 6, fontSize: 11 }}
                                        onClick={e => { e.stopPropagation(); handleFlagEmergency(p) }}>⚑</button>
                                    <button className="btn-red" style={{ padding: '6px 8px', borderRadius: 6, fontSize: 11 }}
                                        onClick={e => { e.stopPropagation(); handleSkip(p) }}>SKIP</button>
                                </div>
                            </div>
                        ))}
                        {waitingQueue.length === 0 && !activePatient && (
                            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', fontSize: 13 }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                                Queue cleared for today!
                            </div>
                        )}
                    </div>
                </div>

                {/* MIDDLE — CURRENT PATIENT */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {activePatient ? (
                        <>
                            <div style={{ padding: 20, borderBottom: '1px solid rgba(0,212,189,0.08)', flexShrink: 0 }}>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Current Patient</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(0,212,189,0.2), rgba(0,212,189,0.05))', border: '2px solid rgba(0,212,189,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: 'var(--accent-teal)' }}>
                                        {activePatient.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1 }}>{activePatient.name}</div>
                                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Token <span style={{ color: 'var(--accent-teal)' }}>#{String(activePatient.token_number).padStart(3, '0')}</span> · {activePatient.reason}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="glass-card" style={{ padding: 16 }}>
                                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, textAlign: 'center' }}>Urgency Score</div>
                                    <UrgencyGauge value={activePatient.urgency} />
                                </div>

                                <div className="glass-card gradient-border" style={{ padding: 16 }}>
                                    <ConsultTimer startTime={activePatient.consultation_start} />
                                </div>

                                <div>
                                    <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Consultation Notes</label>
                                    <textarea className="input-field" rows={4} placeholder="Type consultation notes here..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical', lineHeight: 1.6 }} />
                                </div>

                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={handleComplete} className="btn-teal" disabled={loading.complete}
                                        style={{ flex: 1, padding: '14px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        {loading.complete ? '⏳ Completing...' : '✓ Mark Complete'}
                                    </button>
                                    <button className="btn-red emergency-glow" style={{ padding: '14px 20px', borderRadius: 8, fontSize: 13 }}
                                        onClick={() => handleFlagEmergency(activePatient)}>
                                        ⚠ Flag Emergency
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: 48 }}>👨‍⚕️</div>
                            <div style={{ fontFamily: 'Syne', fontWeight: 600, fontSize: 16 }}>No Active Patient</div>
                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12 }}>Select a patient from the queue to begin</div>
                        </div>
                    )}
                </div>

                {/* RIGHT — STATS */}
                <div style={{ borderLeft: '1px solid rgba(0,212,189,0.08)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Hourly Consultations</div>
                        <div style={{ display: 'flex', align: 'flex-end', gap: 5, height: 80, alignItems: 'flex-end' }}>
                            {HOURLY_DATA.map((v, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: '100%', background: i === 5 ? 'var(--accent-teal)' : 'rgba(0,212,189,0.25)', borderRadius: '3px 3px 0 0', height: `${(v / maxBar) * 60}px`, boxShadow: i === 5 ? '0 0 10px rgba(0,212,189,0.4)' : 'none', transition: 'all 0.5s ease' }} />
                                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-dim)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 28 }}>{HOURS[i]}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: 16, borderColor: 'rgba(0,212,189,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 20 }}>⚡</span>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Today's Count</div>
                        </div>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                            Patients seen: <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>{stats.completed_today || 0}</span> today from this queue.
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                                <span>Queue: {waitingQueue.length} waiting</span><span>Est: {waitingQueue.length * 12} min total</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${Math.min(100, (stats.completed_today / 20) * 100)}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
