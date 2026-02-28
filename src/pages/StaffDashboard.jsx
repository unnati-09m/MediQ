import { useState, useEffect, useRef } from 'react'
import api from '../api'
import socket from '../socket'

function PriorityBadge({ urgency }) {
    if (urgency >= 9) return <span className="badge badge-red">🚨 critical</span>
    if (urgency >= 6) return <span className="badge badge-amber">⚡ urgent</span>
    return <span className="badge badge-teal">• normal</span>
}

function formatWait(secs) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    if (m === 0) return `${s}s`
    return `${m}m ${String(s).padStart(2, '0')}s`
}

function WaitTimer({ createdAt }) {
    const [secs, setSecs] = useState(0)
    useEffect(() => {
        if (!createdAt) return
        const update = () => {
            const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
            setSecs(elapsed)
        }
        update()
        const t = setInterval(update, 1000)
        return () => clearInterval(t)
    }, [createdAt])
    const color = secs > 900 ? 'var(--accent-red)' : secs > 600 ? 'var(--accent-amber)' : 'var(--text-muted)'
    return <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color }}>{formatWait(secs)}</span>
}

const LOG_COLORS = { info: '#6B8CAE', warn: '#FFB020', error: '#FF4757', success: '#00E676' }

export default function StaffDashboard() {
    const [queue, setQueue] = useState([])
    const [doctors, setDoctors] = useState([])
    const [log, setLog] = useState([])
    const [showRegisterModal, setShowRegisterModal] = useState(false)
    const [newPatient, setNewPatient] = useState({ name: '', reason: 'General Checkup', urgency: 5 })
    const [stats, setStats] = useState({ in_queue: 0, in_consultation: 0, completed_today: 0, no_shows_today: 0 })
    const [loading, setLoading] = useState({})
    const logRef = useRef(null)

    function addLog(msg, type = 'info') {
        const now = new Date()
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        setLog(l => [{ time, msg, type }, ...l.slice(0, 24)])
    }

    async function fetchAll() {
        try {
            const [qRes, dRes, sRes, logRes] = await Promise.all([
                api.get('/patients/queue'),
                api.get('/doctors'),
                api.get('/patients/stats'),
                api.get('/staff/logs').catch(() => ({ data: [] })),
            ])
            setQueue(qRes.data)
            setDoctors(dRes.data)
            setStats(sRes.data)
            if (logRes.data?.length > 0) {
                setLog(logRes.data.map(e => ({
                    time: new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                    msg: `${e.event_type.replace(/_/g, ' ')} — ref #${e.reference_id || '—'}`,
                    type: e.event_type.includes('emergency') ? 'error' :
                        e.event_type.includes('complete') ? 'success' :
                            e.event_type.includes('noshow') ? 'warn' : 'info',
                })))
            }
        } catch { }
    }

    useEffect(() => {
        fetchAll()

        const onQueueUpdated = (data) => {
            if (data.queue) setQueue(data.queue)
            if (data.stats) setStats(data.stats)
        }
        const onDoctorStatus = (data) => {
            setDoctors(prev => prev.map(d =>
                d.id === data.doctor_id ? { ...d, ...data } : d
            ))
            addLog(`${data.doctor_name} marked ${data.is_active ? (data.is_on_break ? 'ON BREAK' : 'ON DUTY') : 'INACTIVE'}`, data.is_active ? 'info' : 'warn')
        }
        const onPatientStatus = (data) => {
            const typeMap = { completed: 'success', no_show: 'warn', in_consultation: 'info' }
            addLog(`Token #${String(data.token_number).padStart(3, '0')} → ${data.status}${data.doctor_name ? ` (${data.doctor_name})` : ''}`, typeMap[data.status] || 'info')
        }
        const onEmergency = (data) => {
            addLog(`🚨 EMERGENCY Token #${String(data.token_number).padStart(3, '0')} — ${data.name} — queue reshuffled`, 'error')
        }

        socket.on('queue_updated', onQueueUpdated)
        socket.on('doctor_status_changed', onDoctorStatus)
        socket.on('patient_status_changed', onPatientStatus)
        socket.on('emergency_added', onEmergency)

        const pollInterval = setInterval(fetchAll, 20000)

        return () => {
            socket.off('queue_updated', onQueueUpdated)
            socket.off('doctor_status_changed', onDoctorStatus)
            socket.off('patient_status_changed', onPatientStatus)
            socket.off('emergency_added', onEmergency)
            clearInterval(pollInterval)
        }
    }, [])

    async function toggleDoctor(doctor) {
        setLoading(l => ({ ...l, [`doc_${doctor.id}`]: true }))
        try {
            const wasActive = doctor.is_active && !doctor.is_on_break
            await api.put(`/staff/toggle-doctor/${doctor.id}`, {
                is_active: true,
                is_on_break: wasActive,  // toggle break
            })
            await fetchAll()
            addLog(`${doctor.name} → ${wasActive ? 'ON BREAK' : 'AVAILABLE'}`, wasActive ? 'warn' : 'success')
        } catch (err) {
            addLog(`Error toggling ${doctor.name}: ${err.message}`, 'error')
        } finally {
            setLoading(l => ({ ...l, [`doc_${doctor.id}`]: false }))
        }
    }

    async function addWalkIn() {
        if (!newPatient.name.trim()) return
        setLoading(l => ({ ...l, walkin: true }))
        try {
            const res = await api.post('/staff/register-walkin', {
                name: newPatient.name,
                phone: '0000000000',
                reason: newPatient.reason,
                urgency: newPatient.urgency,
            })
            addLog(`Walk-in Token #${String(res.data.token_number).padStart(3, '0')} — ${newPatient.name}`, 'success')
            setNewPatient({ name: '', reason: 'General Checkup', urgency: 5 })
            setShowRegisterModal(false)
            await fetchAll()
        } catch (err) {
            addLog(`Walk-in error: ${err.message}`, 'error')
        } finally {
            setLoading(l => ({ ...l, walkin: false }))
        }
    }

    async function addEmergency() {
        setLoading(l => ({ ...l, emergency: true }))
        try {
            const res = await api.post('/staff/add-emergency', {
                name: 'Emergency Patient',
                phone: '0000000000',
                reason: 'Emergency',
            })
            addLog(`🚨 EMERGENCY Token #${String(res.data.token_number).padStart(3, '0')} added — queue reshuffled`, 'error')
            await fetchAll()
        } catch (err) {
            addLog(`Emergency error: ${err.message}`, 'error')
        } finally {
            setLoading(l => ({ ...l, emergency: false }))
        }
    }

    async function markNoShow(patient) {
        setLoading(l => ({ ...l, [`noshow_${patient.id}`]: true }))
        try {
            await api.post(`/staff/mark-noshow/${patient.id}`)
            addLog(`Token #${String(patient.token_number).padStart(3, '0')} marked as NO-SHOW`, 'warn')
            await fetchAll()
        } catch (err) {
            addLog(`No-show error: ${err.message}`, 'error')
        } finally {
            setLoading(l => ({ ...l, [`noshow_${patient.id}`]: false }))
        }
    }

    async function rebalance() {
        setLoading(l => ({ ...l, rebalance: true }))
        try {
            const res = await api.post('/staff/rebalance')
            addLog(`Queue rebalanced — ${res.data.queue_length} patients re-scored`, 'success')
            await fetchAll()
        } catch { } finally {
            setLoading(l => ({ ...l, rebalance: false }))
        }
    }

    const kanban = {
        waiting: queue.filter(p => p.status === 'waiting'),
        inConsult: queue.filter(p => p.status === 'in_consultation'),
        completed: queue.filter(p => p.status === 'completed').slice(0, 5),
        noShow: queue.filter(p => p.status === 'no_show').slice(0, 5),
    }

    const COLS = [
        { key: 'waiting', label: 'WAITING', color: '#3D7FFF', data: kanban.waiting },
        { key: 'inConsult', label: 'IN CONSULTATION', color: '#00D4BD', data: kanban.inConsult },
        { key: 'completed', label: 'COMPLETED', color: '#00E676', data: kanban.completed },
        { key: 'noShow', label: 'NO-SHOW', color: '#6B8CAE', data: kanban.noShow },
    ]

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* TOP BAR */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(0,212,189,0.12)', background: 'rgba(10,22,40,0.95)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>Staff Control Centre</h1>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>MediQ Clinic · Real-time Management</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setShowRegisterModal(true)} className="btn-teal" style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13 }}>+ Register Walk-in</button>
                        <button onClick={rebalance} className="btn-outline" disabled={loading.rebalance} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13 }}>
                            {loading.rebalance ? '⏳' : '⚙'} Rebalance
                        </button>
                        <button className="btn-red emergency-glow" onClick={addEmergency} disabled={loading.emergency}
                            style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            🚨 {loading.emergency ? 'Adding...' : 'Add Emergency'}
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN — split */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
                {/* KANBAN */}
                <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(0,212,189,0.08)' }}>
                    <div style={{ padding: '12px 16px 0', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Live Queue Manager</div>
                    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '12px 16px 16px', display: 'flex', gap: 12 }}>
                        {COLS.map(col => (
                            <div key={col.key} className="kanban-col" style={{ minWidth: 200, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, fontSize: 11, color: col.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{col.label}</span>
                                    <span style={{ background: col.color + '22', color: col.color, border: `1px solid ${col.color}44`, borderRadius: 9999, padding: '2px 10px', fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700 }}>{col.data.length}</span>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {col.data.map(card => (
                                        <div key={card.id} style={{
                                            background: col.key === 'noShow' ? 'rgba(107,140,174,0.05)' : card.urgency >= 9 ? 'rgba(255,71,87,0.06)' : 'rgba(10,22,40,0.8)',
                                            border: `1px solid ${card.urgency >= 9 ? 'rgba(255,71,87,0.3)' : col.key === 'noShow' ? 'rgba(107,140,174,0.15)' : 'rgba(0,212,189,0.12)'}`,
                                            borderRadius: 8, padding: '10px 12px',
                                            opacity: col.key === 'noShow' ? 0.5 : 1,
                                            animation: card.urgency >= 9 && col.key === 'waiting' ? 'emergencyPulse 1.5s infinite' : 'none',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 14, fontWeight: 700, color: col.key === 'noShow' ? 'var(--text-dim)' : 'var(--text-primary)' }}>#{String(card.token_number).padStart(3, '0')}</span>
                                                <PriorityBadge urgency={card.urgency} />
                                            </div>
                                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: col.key === 'noShow' ? 'var(--text-muted)' : 'var(--text-primary)', marginBottom: 3 }}>{card.name}</div>
                                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-dim)', marginBottom: col.key === 'waiting' ? 6 : 0 }}>{card.reason}</div>
                                            {col.key === 'waiting' && <WaitTimer createdAt={card.created_at} />}
                                            {col.key === 'waiting' && (
                                                <button onClick={() => markNoShow(card)} disabled={loading[`noshow_${card.id}`]}
                                                    style={{ marginTop: 6, width: '100%', padding: '4px', borderRadius: 4, background: 'rgba(107,140,174,0.1)', border: '1px solid rgba(107,140,174,0.2)', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', fontSize: 10, cursor: 'pointer' }}>
                                                    {loading[`noshow_${card.id}`] ? '...' : 'Mark No-Show'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {col.data.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 20, fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-dim)', borderRadius: 6, border: '1px dashed rgba(107,140,174,0.15)' }}>Empty</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CONTROL PANEL */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Doctor Toggles */}
                    <div style={{ padding: 16, borderBottom: '1px solid rgba(0,212,189,0.08)' }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Doctor Availability</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {doctors.map(d => {
                                const on = d.is_active && !d.is_on_break
                                const initials = d.name.split(' ').map(w => w[0]).slice(0, 2).join('')
                                return (
                                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(10,22,40,0.6)', border: `1px solid ${on ? 'rgba(0,212,189,0.2)' : 'rgba(107,140,174,0.12)'}`, borderRadius: 8, padding: '10px 14px' }}>
                                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: on ? 'rgba(0,212,189,0.15)' : 'rgba(107,140,174,0.1)', border: `2px solid ${on ? 'rgba(0,212,189,0.4)' : 'rgba(107,140,174,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontWeight: 700, fontSize: 12, color: on ? 'var(--accent-teal)' : 'var(--text-muted)', flexShrink: 0 }}>{initials}</div>
                                        <div style={{ flex: 1, lineHeight: 1 }}>
                                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>{d.name}</div>
                                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{d.specialization}</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={on} onChange={() => toggleDoctor(d)} disabled={loading[`doc_${d.id}`]} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,212,189,0.08)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[
                                ['In Queue', stats.in_queue || 0, 'teal'],
                                ['Consulting', stats.in_consultation || 0, 'blue'],
                                ['Completed', stats.completed_today || 0, 'teal'],
                                ['No-Shows', stats.no_shows_today || 0, 'teal'],
                            ].map(([l, v, c]) => (
                                <div key={l} style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,212,189,0.08)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 18, fontWeight: 700, color: `var(--accent-${c})` }}>{v}</div>
                                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Terminal Log */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '12px 16px 16px' }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="pulse-dot green" style={{ width: 6, height: 6 }} />
                            Activity Log
                        </div>
                        <div className="terminal-log" ref={logRef} style={{ flex: 1, padding: '12px 14px', overflowY: 'auto' }}>
                            {log.length === 0 && (
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-dim)' }}>Waiting for events…</div>
                            )}
                            {log.map((entry, i) => (
                                <div key={i} style={{ marginBottom: 4, display: 'flex', gap: 8 }}>
                                    <span style={{ color: 'rgba(0,230,118,0.4)', flexShrink: 0 }}>{entry.time}</span>
                                    <span style={{ color: LOG_COLORS[entry.type] || '#6B8CAE' }}>—</span>
                                    <span style={{ color: LOG_COLORS[entry.type] || '#6B8CAE', flex: 1 }}>{entry.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* WALK-IN MODAL */}
            {showRegisterModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,13,26,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowRegisterModal(false)}>
                    <div className="glass-card-elevated" style={{ width: 400, padding: 32 }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 20 }}>Register Walk-in Patient</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <input className="input-field" placeholder="Patient full name" value={newPatient.name} onChange={e => setNewPatient(n => ({ ...n, name: e.target.value }))} />
                            <select className="input-field" value={newPatient.reason} onChange={e => setNewPatient(n => ({ ...n, reason: e.target.value }))}>
                                {['General Checkup', 'Fever / Cold', 'Follow-up / Prescription', 'Specialist Consult', 'Emergency'].map(r => <option key={r}>{r}</option>)}
                            </select>
                            <div>
                                <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Urgency (1–10): {newPatient.urgency}</label>
                                <input type="range" min="1" max="10" value={newPatient.urgency} onChange={e => setNewPatient(n => ({ ...n, urgency: parseInt(e.target.value) }))} style={{ width: '100%' }} />
                            </div>
                            <button onClick={addWalkIn} className="btn-teal" disabled={loading.walkin} style={{ padding: '13px', borderRadius: 8, fontSize: 14 }}>
                                {loading.walkin ? '⏳ Processing...' : 'Confirm & Issue Token'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
