import { useState, useEffect } from 'react'
import api from '../api'
import socket from '../socket'

function StatusBadge({ status }) {
    const map = {
        'WITH PATIENT': { cls: 'badge-blue', dot: 'blue' },
        'AVAILABLE': { cls: 'badge-teal', dot: 'teal' },
        'ON BREAK': { cls: 'badge-amber', dot: 'amber' },
    }
    const s = map[status] || map['AVAILABLE']
    return (
        <span className={`badge ${s.cls}`}>
            <span className={`pulse-dot ${s.dot}`} style={{ width: 6, height: 6 }} />
            {status}
        </span>
    )
}

function DigitalClock() {
    const [time, setTime] = useState(new Date())
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])
    const pad = n => String(n).padStart(2, '0')
    return (
        <div style={{ fontFamily: 'Orbitron, monospace', textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-teal)', letterSpacing: '0.08em', lineHeight: 1 }}>
                {pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'IBM Plex Mono', letterSpacing: '0.05em' }}>
                {time.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
        </div>
    )
}

function HeroBadge({ currentPatient }) {
    const [ping, setPing] = useState(false)
    useEffect(() => {
        const t = setInterval(() => { setPing(p => !p) }, 2000)
        return () => clearInterval(t)
    }, [])

    const calling = currentPatient || { token_number: '---', name: '—', doctor: '—', room: '—' }
    const doctorName = calling.assigned_doctor_name || '—'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pulse-dot teal" /> NOW CALLING
            </div>
            <div className="glow-ring" style={{ marginBottom: 24 }}>
                <div style={{
                    width: 180, height: 180, borderRadius: '50%',
                    background: 'rgba(0,212,189,0.07)',
                    border: '3px solid var(--accent-teal)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 60px rgba(0,212,189,0.25), 0 0 120px rgba(0,212,189,0.08)',
                }}>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--accent-teal)', letterSpacing: '0.15em', marginBottom: 4 }}>TOKEN</div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 64, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                        #{String(calling.token_number).padStart(3, '0')}
                    </div>
                </div>
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color: 'var(--text-primary)', marginBottom: 8 }}>
                {calling.name?.split(' ')[0] || '—'}
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: 'var(--text-muted)' }}>
                {doctorName}
            </div>
        </div>
    )
}

function doctorStatus(doctor) {
    if (!doctor.is_active) return 'UNAVAILABLE'
    if (doctor.is_on_break) return 'ON BREAK'
    if (doctor.current_patient_id) return 'WITH PATIENT'
    return 'AVAILABLE'
}

const TICKER_ITEMS = [
    'MediQ intelligent queue system is live — real-time priority management active',
    'Urgency-based scoring ensures critical patients are seen first',
    'Queue auto-updates in real time — no manual refresh needed',
]

export default function LiveQueueDisplay() {
    const [queue, setQueue] = useState([])
    const [doctors, setDoctors] = useState([])
    const [stats, setStats] = useState({ in_queue: 0, avg_wait_minutes: 0, completed_today: 0 })
    const [tickerItems, setTickerItems] = useState(TICKER_ITEMS)

    const currentPatient = queue.find(p => p.status === 'in_consultation') || null
    const waitingQueue = queue.filter(p => p.status === 'waiting').slice(0, 5)

    async function fetchAll() {
        try {
            const [qRes, dRes] = await Promise.all([
                api.get('/patients/queue'),
                api.get('/doctors'),
            ])
            setQueue(qRes.data)
            setDoctors(dRes.data)
        } catch { /* keep last state */ }

        try {
            const sRes = await api.get('/patients/stats')
            setStats(sRes.data)
        } catch { }
    }

    useEffect(() => {
        fetchAll()

        // Real-time updates via Socket.IO
        const onQueueUpdated = (data) => {
            if (data.queue) setQueue(data.queue)
            if (data.stats) setStats(data.stats)
        }
        const onDoctorStatus = (data) => {
            setDoctors(prev => prev.map(d =>
                d.id === data.doctor_id
                    ? { ...d, is_active: data.is_active, is_on_break: data.is_on_break, current_patient_id: data.current_patient_id }
                    : d
            ))
        }
        const onEmergency = (data) => {
            setTickerItems(t => [
                `🚨 EMERGENCY: Token #${String(data.token_number).padStart(3, '0')} — ${data.name} — added to top of queue`,
                ...t.slice(0, 4),
            ])
        }
        const onPatientStatus = (data) => {
            if (data.status === 'in_consultation') {
                setTickerItems(t => [
                    `Token #${String(data.token_number).padStart(3, '0')} — Now with ${data.doctor_name || 'doctor'}`,
                    ...t.slice(0, 4),
                ])
            }
        }

        socket.on('queue_updated', onQueueUpdated)
        socket.on('doctor_status_changed', onDoctorStatus)
        socket.on('emergency_added', onEmergency)
        socket.on('patient_status_changed', onPatientStatus)

        // Polling fallback every 15s
        const pollInterval = setInterval(fetchAll, 15000)

        return () => {
            socket.off('queue_updated', onQueueUpdated)
            socket.off('doctor_status_changed', onDoctorStatus)
            socket.off('emergency_added', onEmergency)
            socket.off('patient_status_changed', onPatientStatus)
            clearInterval(pollInterval)
        }
    }, [])

    const docStatusColor = { 'WITH PATIENT': 'var(--accent-blue)', 'AVAILABLE': 'var(--accent-teal)', 'ON BREAK': 'var(--accent-amber)', 'UNAVAILABLE': 'var(--accent-red)' }

    return (
        <div className="scanlines" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            {/* TOP BAR */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid rgba(0,212,189,0.12)', background: 'rgba(10,22,40,0.9)', flex: '0 0 auto' }}>
                <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                        ✚ MediQ Clinic
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>Mumbai, Maharashtra</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="pulse-dot teal" />
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Queue Live</span>
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Real-time Socket.IO</div>
                </div>
                <DigitalClock />
            </div>

            {/* MAIN GRID */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 0, overflow: 'hidden' }}>
                {/* COL 1 — UP NEXT */}
                <div style={{ padding: 24, borderRight: '1px solid rgba(0,212,189,0.08)', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 4, height: 16, background: 'var(--accent-blue)', borderRadius: 2, display: 'inline-block' }} />
                        Up Next ({waitingQueue.length})
                    </div>
                    {waitingQueue.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 24, fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>No patients waiting</div>
                    )}
                    {waitingQueue.map((p, i) => (
                        <div key={p.id} className="glass-card" style={{ padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 22, fontWeight: 700, color: i === 0 ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                                    #{String(p.token_number).padStart(3, '0')}
                                </div>
                                {p.urgency >= 8 && <span className="badge badge-red">Critical</span>}
                                {p.urgency >= 5 && p.urgency < 8 && <span className="badge badge-amber">Urgent</span>}
                                {p.urgency < 5 && <span className="badge badge-teal">Normal</span>}
                            </div>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{p.name}</div>
                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>~{p.estimated_wait_minutes} min</div>
                            <div style={{ marginTop: 10 }}>
                                <div className="progress-bar-bg">
                                    <div className="progress-bar-fill" style={{ width: `${100 - (i + 1) * 18}%`, background: i === 0 ? 'var(--accent-teal)' : 'linear-gradient(90deg, var(--accent-blue), #1a3a7a)' }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* COL 2 — HERO */}
                <div className="dot-grid" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, rgba(0,212,189,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
                    <HeroBadge currentPatient={currentPatient} />
                </div>

                {/* COL 3 — DOCTOR STATUS + LIVE STATS */}
                <div style={{ borderLeft: '1px solid rgba(0,212,189,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flex: 1, padding: 20, overflowY: 'auto', borderBottom: '1px solid rgba(0,212,189,0.08)' }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span style={{ width: 4, height: 14, background: 'var(--accent-teal)', borderRadius: 2, display: 'inline-block' }} />
                            Doctor Status
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {doctors.map(d => {
                                const ds = doctorStatus(d)
                                const clr = docStatusColor[ds]
                                const initials = d.name.split(' ').map(w => w[0]).slice(0, 2).join('')
                                return (
                                    <div key={d.id} className="doctor-card">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `${clr}33`, border: `2px solid ${clr}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: clr }}>
                                                {initials}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1 }}>{d.name}</div>
                                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{d.specialization}</div>
                                            </div>
                                        </div>
                                        <StatusBadge status={ds} />
                                        {d.current_patient_token && (
                                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Patient: <span style={{ color: 'var(--accent-teal)' }}>#{String(d.current_patient_token).padStart(3, '0')}</span></div>
                                        )}
                                        <div style={{ marginTop: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                <span>Seen today</span><span style={{ color: clr }}>{d.total_consulted_today}</span>
                                            </div>
                                            <div className="progress-bar-bg">
                                                <div className="progress-bar-fill" style={{ width: `${Math.min(100, (d.total_consulted_today / 20) * 100)}%`, background: clr }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Live Stats */}
                    <div style={{ padding: 20, flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span style={{ width: 4, height: 14, background: 'var(--accent-amber)', borderRadius: 2, display: 'inline-block' }} />
                            Live Stats
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { label: 'In Queue', value: stats.in_queue || 0, color: 'var(--accent-teal)', unit: '' },
                                { label: 'Avg Wait', value: stats.avg_wait_minutes || 0, color: 'var(--accent-blue)', unit: 'm' },
                                { label: 'Served Today', value: stats.completed_today || 0, color: 'var(--accent-teal)', unit: '' },
                                { label: 'No-Shows', value: stats.no_shows_today || 0, color: 'var(--accent-amber)', unit: '' },
                            ].map(s => (
                                <div key={s.label} style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,212,189,0.1)', borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}{s.unit}</div>
                                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* BOTTOM TICKER */}
            <div style={{ borderTop: '1px solid rgba(0,212,189,0.12)', background: 'rgba(10,22,40,0.95)', padding: '10px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                <div style={{ background: 'var(--accent-teal)', color: '#050D1A', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 11, padding: '4px 14px', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0, borderRight: '2px solid rgba(0,212,189,0.3)' }}>
                    LIVE
                </div>
                <div className="ticker-wrap" style={{ flex: 1 }}>
                    <div className="ticker-content" style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>
                        {tickerItems.join('   ·   ')} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {tickerItems.join('   ·   ')}
                    </div>
                </div>
            </div>
        </div>
    )
}
