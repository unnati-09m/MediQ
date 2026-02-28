import { useState, useEffect } from 'react'

const CURRENT_PATIENT = { token: '043', firstname: 'Rahul', doctor: 'Dr. Priya Sharma', room: 'Room 1' }
const UP_NEXT = [
    { token: '044', name: 'Sunita P.', wait: '~8 min', urgency: 'normal' },
    { token: '045', name: 'Arjun N.', wait: '~16 min', urgency: 'urgent' },
    { token: '046', name: 'Meera J.', wait: '~24 min', urgency: 'normal' },
]
const DOCTORS = [
    { name: 'Dr. Priya Sharma', specialty: 'General Medicine', status: 'WITH PATIENT', token: '#043', seen: 8, total: 12, avatar: 'PS' },
    { name: 'Dr. Anil Mehta', specialty: 'Cardiology', status: 'AVAILABLE', token: '—', seen: 6, total: 12, avatar: 'AM' },
    { name: 'Dr. Sneha Rao', specialty: 'Pediatrics', status: 'ON BREAK', token: '—', seen: 5, total: 12, avatar: 'SR' },
]
const TICKER_ITEMS = [
    'Token #038 — Please proceed to Room 2 immediately',
    'Token #041 — Dr. Anil Mehta will see you shortly in Room 2',
    'Token #044 — Please be ready, you are next in line',
    'Token #039 — Consultation complete, thank you for visiting MediFlow Clinic',
    'Attention: Token #046 — Priority queue update, please check your position',
    'Dr. Sneha Rao returns from break at 3:45 PM',
]

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

function HeroBadge() {
    const [ping, setPing] = useState(false)
    useEffect(() => {
        const t = setInterval(() => { setPing(p => !p) }, 2000)
        return () => clearInterval(t)
    }, [])

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
                        #{CURRENT_PATIENT.token}
                    </div>
                </div>
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color: 'var(--text-primary)', marginBottom: 8 }}>
                {CURRENT_PATIENT.firstname}
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: 'var(--text-muted)' }}>
                {CURRENT_PATIENT.doctor} &nbsp;·&nbsp; {CURRENT_PATIENT.room}
            </div>
        </div>
    )
}

export default function LiveQueueDisplay() {
    const [liveStats, setLiveStats] = useState({ inQueue: 9, avgWait: 22, served: 41 })

    useEffect(() => {
        const t = setInterval(() => {
            setLiveStats(s => ({ ...s, avgWait: s.avgWait + (Math.random() > 0.5 ? 1 : -1) }))
        }, 5000)
        return () => clearInterval(t)
    }, [])

    const docStatusColor = { 'WITH PATIENT': 'var(--accent-blue)', 'AVAILABLE': 'var(--accent-teal)', 'ON BREAK': 'var(--accent-amber)' }

    return (
        <div className="scanlines" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            {/* TOP BAR */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid rgba(0,212,189,0.12)', background: 'rgba(10,22,40,0.9)', flex: '0 0 auto' }}>
                <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                        ✚ MediFlow Clinic
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>Mumbai, Maharashtra</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="pulse-dot teal" />
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Queue Live</span>
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Auto-refreshes every 15s</div>
                </div>

                <DigitalClock />
            </div>

            {/* MAIN GRID */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 0, overflow: 'hidden' }}>
                {/* COL 1 — UP NEXT */}
                <div style={{ padding: 24, borderRight: '1px solid rgba(0,212,189,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 4, height: 16, background: 'var(--accent-blue)', borderRadius: 2, display: 'inline-block' }} />
                        Up Next
                    </div>
                    {UP_NEXT.map((p, i) => (
                        <div key={p.token} className="glass-card" style={{ padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 22, fontWeight: 700, color: i === 0 ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                                    #{p.token}
                                </div>
                                {p.urgency === 'urgent' && <span className="badge badge-red">Urgent</span>}
                            </div>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{p.name}</div>
                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>{p.wait}</div>
                            <div style={{ marginTop: 10 }}>
                                <div className="progress-bar-bg">
                                    <div className="progress-bar-fill" style={{ width: `${100 - (i + 1) * 25}%`, background: i === 0 ? 'var(--accent-teal)' : 'linear-gradient(90deg, var(--accent-blue), #1a3a7a)' }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* COL 2 — HERO */}
                <div className="dot-grid" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, rgba(0,212,189,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
                    <HeroBadge />
                </div>

                {/* COL 3 — DOCTOR STATUS + LIVE STATS */}
                <div style={{ borderLeft: '1px solid rgba(0,212,189,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Doctor Status */}
                    <div style={{ flex: 1, padding: 20, overflowY: 'auto', borderBottom: '1px solid rgba(0,212,189,0.08)' }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span style={{ width: 4, height: 14, background: 'var(--accent-teal)', borderRadius: 2, display: 'inline-block' }} />
                            Doctor Status
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {DOCTORS.map(d => (
                                <div key={d.name} className="doctor-card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                            background: `linear-gradient(135deg, ${docStatusColor[d.status]}33, ${docStatusColor[d.status]}11)`,
                                            border: `2px solid ${docStatusColor[d.status]}55`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12,
                                            color: docStatusColor[d.status],
                                        }}>{d.avatar}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1 }}>{d.name}</div>
                                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{d.specialty}</div>
                                        </div>
                                    </div>
                                    <StatusBadge status={d.status} />
                                    {d.token !== '—' && (
                                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Patient: <span style={{ color: 'var(--accent-teal)' }}>{d.token}</span></div>
                                    )}
                                    <div style={{ marginTop: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                                            <span>Seen today</span><span style={{ color: docStatusColor[d.status] }}>{d.seen}/{d.total}</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: `${(d.seen / d.total) * 100}%`, background: docStatusColor[d.status] }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                                { label: 'In Queue', value: liveStats.inQueue, color: 'var(--accent-teal)', unit: '' },
                                { label: 'Avg Wait', value: liveStats.avgWait, color: 'var(--accent-blue)', unit: 'm' },
                                { label: 'Served Today', value: liveStats.served, color: 'var(--accent-teal)', unit: '' },
                                { label: 'Best Wait', value: 8, color: 'var(--accent-amber)', unit: 'm' },
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
                        {TICKER_ITEMS.join('   ·   ')} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {TICKER_ITEMS.join('   ·   ')}
                    </div>
                </div>
            </div>
        </div>
    )
}
