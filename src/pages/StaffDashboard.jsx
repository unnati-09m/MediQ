import { useState, useEffect, useRef } from 'react'

const INITIAL_KANBAN = {
    waiting: [
        { token: '045', name: 'Arjun Nair', wait: 820, priority: 'urgent', reason: 'Fever / Cold' },
        { token: '046', name: 'Meera Joshi', wait: 540, priority: 'normal', reason: 'Specialist Consult' },
        { token: '047', name: 'Kiran Kumar', wait: 240, priority: 'normal', reason: 'General Checkup' },
        { token: '048', name: 'Rohit Desai', wait: 120, priority: 'critical', reason: 'Emergency' },
    ],
    inConsult: [
        { token: '043', name: 'Rahul Verma', wait: 1420, priority: 'normal', reason: 'General Checkup' },
        { token: '044', name: 'Sunita Patel', wait: 960, priority: 'normal', reason: 'Follow-up' },
    ],
    completed: [
        { token: '041', name: 'Preet Kaur', wait: 0, priority: 'normal', reason: 'General Checkup' },
        { token: '042', name: 'Vishal Shah', wait: 0, priority: 'urgent', reason: 'Fever / Cold' },
    ],
    noShow: [
        { token: '039', name: 'Anjali Rao', wait: 0, priority: 'normal', reason: 'Follow-up' },
    ],
}

const DOCTORS_TOGGLE = [
    { name: 'Dr. Priya Sharma', specialty: 'General', avatar: 'PS', on: true },
    { name: 'Dr. Anil Mehta', specialty: 'Cardiology', avatar: 'AM', on: true },
    { name: 'Dr. Sneha Rao', specialty: 'Pediatrics', avatar: 'SR', on: false },
]

const INITIAL_LOG = [
    { time: '18:32', msg: 'Token #043 consultation started by Dr. Priya Sharma', type: 'info' },
    { time: '18:28', msg: 'Emergency Token #048 added — queue reshuffled', type: 'warn' },
    { time: '18:15', msg: 'Token #039 marked as NO-SHOW', type: 'error' },
    { time: '18:08', msg: 'Token #041 marked complete by Dr. Priya Sharma', type: 'success' },
    { time: '17:55', msg: 'Token #042 marked complete by Dr. Anil Mehta', type: 'success' },
    { time: '17:44', msg: 'Dr. Sneha Rao marked ON BREAK', type: 'warn' },
]

function formatWait(secs) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    if (m === 0) return `${s}s`
    return `${m}m ${String(s).padStart(2, '0')}s`
}

function PriorityBadge({ priority }) {
    const map = { critical: ['badge-red', '🚨'], urgent: ['badge-amber', '⚡'], normal: ['badge-teal', '•'] }
    const [cls, icon] = map[priority] || map.normal
    return <span className={`badge ${cls}`}>{icon} {priority}</span>
}

function WaitTimer({ initial }) {
    const [secs, setSecs] = useState(initial)
    useEffect(() => {
        const t = setInterval(() => setSecs(s => s + 1), 1000)
        return () => clearInterval(t)
    }, [])
    const color = secs > 900 ? 'var(--accent-red)' : secs > 600 ? 'var(--accent-amber)' : 'var(--text-muted)'
    return <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color }}>{formatWait(secs)}</span>
}

export default function StaffDashboard() {
    const [kanban, setKanban] = useState(INITIAL_KANBAN)
    const [doctors, setDoctors] = useState(DOCTORS_TOGGLE)
    const [log, setLog] = useState(INITIAL_LOG)
    const [dragging, setDragging] = useState(null) // {col, idx}
    const [dragOver, setDragOver] = useState(null)
    const [showRegisterModal, setShowRegisterModal] = useState(false)
    const [newPatient, setNewPatient] = useState({ name: '', reason: 'General Checkup', priority: 'normal' })
    const logRef = useRef(null)

    function addLog(msg, type = 'info') {
        const now = new Date()
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        setLog(l => [{ time, msg, type }, ...l.slice(0, 19)])
    }

    function toggleDoctor(idx) {
        setDoctors(ds => ds.map((d, i) => i === idx ? { ...d, on: !d.on } : d))
        const d = doctors[idx]
        addLog(`${d.name} marked ${d.on ? 'OFF DUTY / ON BREAK' : 'ON DUTY'}`, d.on ? 'warn' : 'success')
    }

    function moveCard(fromCol, fromIdx, toCol) {
        if (fromCol === toCol) return
        const card = kanban[fromCol][fromIdx]
        setKanban(k => ({
            ...k,
            [fromCol]: k[fromCol].filter((_, i) => i !== fromIdx),
            [toCol]: [card, ...k[toCol]],
        }))
        addLog(`Token #${card.token} moved from ${fromCol} → ${toCol}`, 'info')
    }

    function addWalkIn() {
        if (!newPatient.name) return
        const token = String(Math.floor(Math.random() * 10) + 49)
        const card = { token, name: newPatient.name, wait: 0, priority: newPatient.priority, reason: newPatient.reason }
        setKanban(k => ({ ...k, waiting: [card, ...k.waiting] }))
        addLog(`Walk-in Token #${token} registered — ${newPatient.name}`, 'success')
        setNewPatient({ name: '', reason: 'General Checkup', priority: 'normal' })
        setShowRegisterModal(false)
    }

    function addEmergency() {
        const token = String(Math.floor(Math.random() * 10) + 52)
        const card = { token, name: 'Emergency Patient', wait: 0, priority: 'critical', reason: 'Emergency' }
        setKanban(k => ({ ...k, waiting: [card, ...k.waiting] }))
        addLog(`🚨 EMERGENCY Token #${token} added — queue reshuffled`, 'error')
    }

    const logColor = { info: '#6B8CAE', warn: '#FFB020', error: '#FF4757', success: '#00E676' }

    const COLS = [
        { key: 'waiting', label: 'WAITING', color: '#3D7FFF', count: kanban.waiting.length },
        { key: 'inConsult', label: 'IN CONSULTATION', color: '#00D4BD', count: kanban.inConsult.length },
        { key: 'completed', label: 'COMPLETED', color: '#00E676', count: kanban.completed.length },
        { key: 'noShow', label: 'NO-SHOW', color: '#6B8CAE', count: kanban.noShow.length },
    ]

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* TOP BAR */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(0,212,189,0.12)', background: 'rgba(10,22,40,0.95)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>Staff Control Centre</h1>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>MediFlow Clinic · Mumbai</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setShowRegisterModal(true)} className="btn-teal" style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13 }}>+ Register Walk-in</button>
                        <button className="btn-outline" style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13 }}>📋 Full Queue</button>
                        <button className="btn-red emergency-glow" onClick={addEmergency} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>🚨 Add Emergency</button>
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
                            <div
                                key={col.key}
                                className="kanban-col"
                                style={{ minWidth: 200, flex: 1, display: 'flex', flexDirection: 'column', borderColor: dragOver === col.key ? col.color + '44' : 'rgba(0,212,189,0.08)' }}
                                onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
                                onDrop={() => {
                                    if (dragging) moveCard(dragging.col, dragging.idx, col.key)
                                    setDragging(null); setDragOver(null)
                                }}
                                onDragLeave={() => setDragOver(null)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, fontSize: 11, color: col.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{col.label}</span>
                                    <span style={{ background: col.color + '22', color: col.color, border: `1px solid ${col.color}44`, borderRadius: 9999, padding: '2px 10px', fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700 }}>{col.count}</span>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {kanban[col.key].map((card, idx) => (
                                        <div
                                            key={card.token}
                                            draggable
                                            onDragStart={() => setDragging({ col: col.key, idx })}
                                            style={{
                                                background: col.key === 'noShow' ? 'rgba(107,140,174,0.05)' : card.priority === 'critical' ? 'rgba(255,71,87,0.06)' : 'rgba(10,22,40,0.8)',
                                                border: `1px solid ${card.priority === 'critical' ? 'rgba(255,71,87,0.3)' : col.key === 'noShow' ? 'rgba(107,140,174,0.15)' : 'rgba(0,212,189,0.12)'}`,
                                                borderRadius: 8, padding: '10px 12px',
                                                opacity: col.key === 'noShow' ? 0.5 : 1,
                                                cursor: 'grab',
                                                animation: card.priority === 'critical' ? 'emergencyPulse 1.5s infinite' : 'none',
                                                position: 'relative', overflow: 'hidden',
                                            }}
                                        >
                                            {col.key === 'noShow' && (
                                                <div style={{ position: 'absolute', top: 6, right: 8, fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', border: '1px solid rgba(107,140,174,0.3)', padding: '2px 6px', borderRadius: 4, transform: 'rotate(-3deg)' }}>SKIPPED</div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 14, fontWeight: 700, color: col.key === 'noShow' ? 'var(--text-dim)' : 'var(--text-primary)' }}>#{card.token}</span>
                                                <PriorityBadge priority={card.priority} />
                                            </div>
                                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: col.key === 'noShow' ? 'var(--text-muted)' : 'var(--text-primary)', marginBottom: 3 }}>{card.name}</div>
                                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-dim)', marginBottom: col.key === 'waiting' ? 6 : 0 }}>{card.reason}</div>
                                            {col.key === 'waiting' && <WaitTimer initial={card.wait} />}
                                            {col.key === 'inConsult' && <WaitTimer initial={card.wait} />}
                                        </div>
                                    ))}
                                    {kanban[col.key].length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 20, fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-dim)', borderRadius: 6, border: '1px dashed rgba(107,140,174,0.15)' }}>Drop here</div>
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
                            {doctors.map((d, i) => (
                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(10,22,40,0.6)', border: `1px solid ${d.on ? 'rgba(0,212,189,0.2)' : 'rgba(107,140,174,0.12)'}`, borderRadius: 8, padding: '10px 14px' }}>
                                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: d.on ? 'rgba(0,212,189,0.15)' : 'rgba(107,140,174,0.1)', border: `2px solid ${d.on ? 'rgba(0,212,189,0.4)' : 'rgba(107,140,174,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontWeight: 700, fontSize: 12, color: d.on ? 'var(--accent-teal)' : 'var(--text-muted)', flexShrink: 0 }}>{d.avatar}</div>
                                    <div style={{ flex: 1, lineHeight: 1 }}>
                                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: d.on ? 'var(--text-primary)' : 'var(--text-muted)' }}>{d.name}</div>
                                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{d.specialty}</div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={d.on} onChange={() => toggleDoctor(i)} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,212,189,0.08)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[
                                ['In Queue', kanban.waiting.length, 'teal'],
                                ['Consulting', kanban.inConsult.length, 'blue'],
                                ['Completed', kanban.completed.length, 'green'],
                                ['No-Shows', kanban.noShow.length, 'grey'],
                            ].map(([l, v, c]) => (
                                <div key={l} style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,212,189,0.08)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 18, fontWeight: 700, color: `var(--accent-${c === 'grey' ? 'teal' : c})`, opacity: c === 'grey' ? 0.6 : 1 }}>{v}</div>
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
                            {log.map((entry, i) => (
                                <div key={i} style={{ marginBottom: 4, display: 'flex', gap: 8 }}>
                                    <span style={{ color: 'rgba(0,230,118,0.4)', flexShrink: 0 }}>{entry.time}</span>
                                    <span style={{ color: logColor[entry.type] || '#6B8CAE' }}>—</span>
                                    <span style={{ color: logColor[entry.type] || '#6B8CAE', flex: 1 }}>{entry.msg}</span>
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
                                <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Priority</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {['normal', 'urgent', 'critical'].map(p => (
                                        <button key={p} onClick={() => setNewPatient(n => ({ ...n, priority: p }))}
                                            className={p === 'critical' ? 'btn-red' : p === 'urgent' ? 'btn-outline' : 'btn-outline'}
                                            style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 12, fontWeight: newPatient.priority === p ? 700 : 400, border: newPatient.priority === p ? `1px solid ${p === 'critical' ? 'var(--accent-red)' : 'var(--accent-teal)'}` : undefined }}>
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={addWalkIn} className="btn-teal" style={{ padding: '13px', borderRadius: 8, fontSize: 14 }}>Confirm & Issue Token</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
