import { useState, useEffect, useRef } from 'react'

const INITIAL_QUEUE = [
    { token: '043', name: 'Rahul Verma', reason: 'General Checkup', urgency: 3, estTime: 15, age: 34, gender: 'M', active: true },
    { token: '044', name: 'Sunita Patel', reason: 'Follow-up / Prescription', urgency: 5, estTime: 10, age: 52, gender: 'F', active: false },
    { token: '045', name: 'Arjun Nair', reason: 'Fever / Cold', urgency: 7, estTime: 12, age: 28, gender: 'M', active: false },
    { token: '046', name: 'Meera Joshi', reason: 'Specialist Consult', urgency: 4, estTime: 20, age: 45, gender: 'F', active: false },
    { token: '047', name: 'Kiran Kumar', reason: 'General Checkup', urgency: 2, estTime: 15, age: 61, gender: 'M', active: false },
]

const HOURLY_DATA = [2, 3, 5, 4, 6, 7, 5, 4, 3]
const HOURS = ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM']

const PATIENT_TYPES = [
    { label: 'General', value: 38, color: '#00D4BD' },
    { label: 'Follow-up', value: 28, color: '#3D7FFF' },
    { label: 'Specialist', value: 20, color: '#FFB020' },
    { label: 'Emergency', value: 14, color: '#FF4757' },
]

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

function ConsultTimer({ running }) {
    const [secs, setSecs] = useState(743)
    const ref = useRef(null)
    useEffect(() => {
        if (!running) return
        ref.current = setInterval(() => setSecs(s => s + 1), 1000)
        return () => clearInterval(ref.current)
    }, [running])
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

function DonutChart() {
    let offset = 0
    const r = 48, cx = 60, cy = 60
    const circ = 2 * Math.PI * r
    const total = PATIENT_TYPES.reduce((a, b) => a + b.value, 0)
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
                {PATIENT_TYPES.map(pt => {
                    const dash = (pt.value / total) * circ
                    const el = (
                        <circle key={pt.label} cx={cx} cy={cy} r={r}
                            fill="none" stroke={pt.color} strokeWidth="14" strokeLinecap="butt"
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-(offset)} transform="rotate(-90, 60, 60)"
                        />
                    )
                    offset += dash
                    return el
                })}
                <text x="60" y="55" textAnchor="middle" fill="var(--text-primary)" fontFamily="Orbitron, monospace" fontSize="14" fontWeight="700">{total}</text>
                <text x="60" y="70" textAnchor="middle" fill="var(--text-muted)" fontFamily="IBM Plex Mono" fontSize="9">PATIENTS</text>
            </svg>
            <div style={{ flex: 1 }}>
                {PATIENT_TYPES.map(pt => (
                    <div key={pt.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: pt.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>{pt.label}</span>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: pt.color }}>{pt.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function DoctorDashboard() {
    const [queue, setQueue] = useState(INITIAL_QUEUE)
    const [activeIdx, setActiveIdx] = useState(0)
    const [notes, setNotes] = useState('')

    const activePatient = queue[activeIdx]

    function markComplete() {
        setQueue(q => {
            const updated = q.filter((_, i) => i !== activeIdx)
            if (updated.length > 0) return updated.map((p, i) => ({ ...p, active: i === 0 }))
            return []
        })
        setActiveIdx(0)
        setNotes('')
    }

    function markUrgent(idx) {
        setQueue(q => q.map((p, i) => i === idx ? { ...p, urgency: Math.min(10, p.urgency + 2) } : p))
    }

    function skipPatient(idx) {
        setQueue(q => [...q.filter((_, i) => i !== idx), { ...q[idx], active: false }])
    }

    function startConsult(idx) {
        setActiveIdx(idx)
        setQueue(q => q.map((p, i) => ({ ...p, active: i === idx })))
    }

    const maxBar = Math.max(...HOURLY_DATA)

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* HEADER */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,212,189,0.12)', background: 'rgba(10,22,40,0.9)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', marginBottom: 2 }}>
                            Good evening, Dr. Priya Sharma 👋
                        </h1>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>Saturday, 28 Feb 2026 · General Medicine</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {[['Patients Seen', '8', 'teal'], ['Avg Consult', '12 min', 'blue'], ['In Queue', String(queue.length), 'amber']].map(([l, v, c]) => (
                            <div key={l} style={{ textAlign: 'center', background: 'rgba(10,22,40,0.8)', border: `1px solid rgba(${c === 'teal' ? '0,212,189' : c === 'blue' ? '61,127,255' : '255,176,32'},0.2)`, borderRadius: 10, padding: '10px 20px' }}>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 20, fontWeight: 700, color: `var(--accent-${c})` }}>{v}</div>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3 COLUMNS */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 300px', overflow: 'hidden' }}>
                {/* LEFT — QUEUE */}
                <div style={{ borderRight: '1px solid rgba(0,212,189,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 16px 8px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Today's Queue ({queue.length})</div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
                        {queue.map((p, i) => (
                            <div key={p.token} className={`patient-card${p.active ? ' active-patient' : ''}`} onClick={() => startConsult(i)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 18, fontWeight: 700, color: p.active ? 'var(--accent-teal)' : 'var(--text-muted)' }}>#{p.token}</div>
                                    <UrgencyBadge urgency={p.urgency} />
                                </div>
                                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>{p.name}</div>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{p.reason} · ~{p.estTime} min</div>
                                {p.active && (
                                    <span className="badge badge-teal" style={{ fontSize: 10 }}>● IN CONSULTATION</span>
                                )}
                                {!p.active && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn-teal" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 11 }} onClick={e => { e.stopPropagation(); startConsult(i) }}>START</button>
                                        <button className="btn-outline" style={{ padding: '6px 8px', borderRadius: 6, fontSize: 11 }} onClick={e => { e.stopPropagation(); markUrgent(i) }}>⚑</button>
                                        <button className="btn-red" style={{ padding: '6px 8px', borderRadius: 6, fontSize: 11 }} onClick={e => { e.stopPropagation(); skipPatient(i) }}>SKIP</button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {queue.length === 0 && (
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
                                        {activePatient.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1 }}>{activePatient.name}</div>
                                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{activePatient.age}yrs · {activePatient.gender === 'M' ? 'Male' : 'Female'}</div>
                                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>Token <span style={{ color: 'var(--accent-teal)' }}>#{activePatient.token}</span> · {activePatient.reason}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Urgency Gauge */}
                                <div className="glass-card" style={{ padding: 16 }}>
                                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, textAlign: 'center' }}>Urgency Score</div>
                                    <UrgencyGauge value={activePatient.urgency} />
                                </div>

                                {/* Timer */}
                                <div className="glass-card gradient-border" style={{ padding: 16 }}>
                                    <ConsultTimer running={true} />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Consultation Notes</label>
                                    <textarea
                                        className="input-field"
                                        rows={4}
                                        placeholder="Type consultation notes here..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        style={{ resize: 'vertical', lineHeight: 1.6 }}
                                    />
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={markComplete} className="btn-teal" style={{ flex: 1, padding: '14px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        ✓ Mark Complete
                                    </button>
                                    <button className="btn-red emergency-glow" style={{ padding: '14px 20px', borderRadius: 8, fontSize: 13 }}>
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

                    <div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Patient Types</div>
                        <DonutChart />
                    </div>

                    <div className="glass-card" style={{ padding: 16, borderColor: 'rgba(0,212,189,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 20 }}>⚡</span>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Performance Insight</div>
                        </div>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                            You're <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>18% faster</span> than the clinic average today. Keep up the excellent pace!
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                                <span>You: 12 min avg</span><span>Clinic: 14.6 min avg</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: '82%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
