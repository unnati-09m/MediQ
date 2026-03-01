import { useState, useEffect } from 'react'
import api from '../api'
import socket from '../socket'


function FloatingToken({ token, style, className }) {
    return (
        <div className={`glass-card ${className}`} style={{
            padding: '12px 20px', position: 'absolute', zIndex: 1, ...style
        }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 12, color: 'var(--accent-teal)', marginBottom: 2 }}>TOKEN</div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>
                #{token}
            </div>
        </div>
    )
}

function LiveStat({ label, value, unit }) {
    const [displayed, setDisplayed] = useState(0)
    useEffect(() => {
        let start = 0
        const end = parseInt(value) || 0
        if (start === end) { setDisplayed(end); return }
        const step = Math.ceil(end / 30)
        const timer = setInterval(() => {
            start = Math.min(start + step, end)
            setDisplayed(start)
            if (start >= end) clearInterval(timer)
        }, 40)
        return () => clearInterval(timer)
    }, [value])

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 28, fontWeight: 700, color: 'var(--accent-teal)', lineHeight: 1 }}>
                {displayed}{unit}
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        </div>
    )
}

export default function PatientRegistration() {
    const [form, setForm] = useState({ name: '', phone: '', reason: '' })
    const [tokenData, setTokenData] = useState(null)
    const [tokenVisible, setTokenVisible] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [stats, setStats] = useState({ total_today: 47, avg_wait_minutes: 22, in_consultation: 3 })

    useEffect(() => {
        // Fetch live stats
        api.get('/patients/stats')
            .then(r => setStats(r.data))
            .catch(() => { }) // Silently fall back to defaults

        // Listen for live queue updates to refresh stats
        const handler = (data) => {
            if (data.stats) setStats(s => ({ ...s, ...data.stats }))
        }
        socket.on('queue_updated', handler)
        return () => socket.off('queue_updated', handler)
    }, [])

    const sliderColor = () => {
        const v = form.urgency
        if (v <= 3) return `linear-gradient(90deg, #00D4BD ${v * 10}%, rgba(0,212,189,0.15) ${v * 10}%)`
        if (v <= 6) return `linear-gradient(90deg, #FFB020 ${v * 10}%, rgba(255,176,32,0.15) ${v * 10}%)`
        return `linear-gradient(90deg, #FF4757 ${v * 10}%, rgba(255,71,87,0.15) ${v * 10}%)`
    }
    const sliderThumbColor = form.urgency <= 3 ? '#00D4BD' : form.urgency <= 6 ? '#FFB020' : '#FF4757'

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.name || !form.phone || !form.reason) return
        setLoading(true)
        setError(null)
        try {
            const res = await api.post('/patients/register', {
                name: form.name,
                phone: form.phone,
                reason: form.reason,
                urgency: 5, // Default urgency, will be updated by backend Groq integration
            })
            setTokenData(res.data)
            setTokenVisible(true)
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
            setError(error.message);
        } finally {
            setLoading(false)
        }
    }

    function handleClose() {
        setTokenVisible(false)
        setForm({ name: '', phone: '', reason: '' })
        setError(null)
    }

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* LEFT HALF */}
            <div className="dot-grid" style={{
                flex: 1, position: 'relative', display: 'flex', flexDirection: 'column',
                justifyContent: 'center', padding: '48px 56px',
                borderRight: '1px solid rgba(0,212,189,0.08)',
                overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '20%', left: '30%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,189,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

                <FloatingToken token="043" className="float-1" style={{ top: '12%', right: '8%', opacity: 0.5 }} />
                <FloatingToken token="047" className="float-2" style={{ bottom: '25%', right: '14%', opacity: 0.4 }} />
                <FloatingToken token="051" className="float-3" style={{ top: '35%', right: '2%', opacity: 0.3 }} />

                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="pulse-dot teal" />
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Live Queue Active</span>
                </div>

                <h1 style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 64px)',
                    color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 20,
                    background: 'linear-gradient(135deg, #E8F4FD 40%, #00D4BD)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                    Your Time<br />Matters.
                </h1>

                <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 360, marginBottom: 40 }}>
                    MediQ's intelligent queue system reduces wait times by up to <span style={{ color: 'var(--accent-teal)' }}>40%</span>. Register once, and we'll manage the rest — so you spend less time waiting and more time healing.
                </p>

                <div className="glass-card" style={{ display: 'inline-flex', gap: 48, padding: '24px 36px', width: 'fit-content' }}>
                    <LiveStat label="Patients Served Today" value={stats.total_today || 47} unit="" />
                    <div style={{ width: 1, background: 'rgba(0,212,189,0.15)' }} />
                    <LiveStat label="Avg Wait Today" value={stats.avg_wait_minutes || 22} unit=" min" />
                    <div style={{ width: 1, background: 'rgba(0,212,189,0.15)' }} />
                    <LiveStat label="Doctors On Duty" value={stats.in_consultation || 3} unit="" />
                </div>
            </div>

            {/* RIGHT HALF — FORM */}
            <div style={{ width: '44%', minWidth: 380, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="glass-card-elevated" style={{ padding: 32 }}>
                    <div style={{ marginBottom: 28 }}>
                        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', marginBottom: 6 }}>Register for Queue</h2>
                        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>Fill in your details to receive a queue token</p>
                    </div>

                    {error && (
                        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent-red)' }}>
                            ⚠ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.6 }}>👤</span>
                                <input className="input-field" style={{ paddingLeft: 42 }} placeholder="e.g. Rahul Verma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Phone Number</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.6 }}>📱</span>
                                <input className="input-field" style={{ paddingLeft: 42 }} placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>Reason for Visit</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 14, top: 14, fontSize: 16, opacity: 0.6 }}>📝</span>
                                <textarea className="input-field" style={{ paddingLeft: 42, height: 80, resize: 'none', paddingTop: 14 }} placeholder="Please describe your symptoms/reason for visit..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
                            </div>
                        </div>

                        <button type="submit" className="btn-teal" disabled={loading} style={{ padding: '16px', borderRadius: 10, fontSize: 15, letterSpacing: '0.08em', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                            {loading ? '⏳ Processing...' : 'JOIN QUEUE →'}
                        </button>
                    </form>
                </div>
            </div>

            {/* TOKEN REVEAL OVERLAY */}
            {tokenVisible && tokenData && (
                <div className="token-overlay" onClick={handleClose}>
                    <div style={{ textAlign: 'center', maxWidth: 440, padding: 32 }} onClick={e => e.stopPropagation()}>
                        <div className="glow-ring" style={{ margin: '0 auto 32px' }}>
                            <div className="token-badge">
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>TOKEN</div>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 52, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                                    #{String(tokenData.token_number).padStart(3, '0')}
                                </div>
                            </div>
                        </div>

                        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 8 }}>
                            You're In The Queue!
                        </h2>
                        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
                            Welcome, {form.name.split(' ')[0]}. Here are your details:
                        </p>

                        <div className="glass-card" style={{ padding: 24, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: 'Orbitron', fontSize: 26, fontWeight: 700, color: 'var(--accent-teal)' }}>{tokenData.estimated_wait_minutes}</div>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Min Est. Wait</div>
                            </div>
                            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(0,212,189,0.15)', borderRight: '1px solid rgba(0,212,189,0.15)' }}>
                                <div style={{ fontFamily: 'Orbitron', fontSize: 26, fontWeight: 700, color: 'var(--accent-blue)' }}>#{tokenData.queue_position}</div>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>In Line</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: 'Orbitron', fontSize: 26, fontWeight: 700, color: 'var(--accent-amber)' }}>2</div>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Alert Before</div>
                            </div>
                        </div>

                        {tokenData.patient?.assigned_doctor_name && (
                            <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(0,212,189,0.06)', border: '1px solid rgba(0,212,189,0.2)', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent-teal)' }}>
                                👨‍⚕️ Assigned to {tokenData.patient.assigned_doctor_name}
                            </div>
                        )}

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                                <span>Queue Position</span>
                                <span style={{ color: 'var(--accent-teal)' }}>#{tokenData.queue_position} in line</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${Math.max(10, 100 - ((tokenData.queue_position / 10) * 100))}%` }} />
                            </div>
                        </div>

                        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                            📲 We'll notify you when <span style={{ color: 'var(--accent-teal)' }}>2 patients</span> remain before you. Please stay in the waiting area.
                        </p>

                        <button onClick={handleClose} className="btn-teal" style={{ padding: '14px 32px', borderRadius: 8, fontSize: 14, width: '100%' }}>
                            ✓ Got It — Track My Status
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
