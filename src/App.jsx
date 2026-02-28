import { useState, useEffect, useRef } from 'react'
import PatientRegistration from './pages/PatientRegistration'
import LiveQueueDisplay from './pages/LiveQueueDisplay'
import DoctorDashboard from './pages/DoctorDashboard'
import StaffDashboard from './pages/StaffDashboard'

const NAV_ITEMS = [
    { id: 'registration', icon: '🏥', label: 'Patient Entry', short: 'Entry' },
    { id: 'queue', icon: '📺', label: 'Live Queue Display', short: 'Queue' },
    { id: 'doctor', icon: '👨‍⚕️', label: 'Doctor View', short: 'Doctor' },
    { id: 'staff', icon: '🗂️', label: 'Staff Control', short: 'Staff' },
]

export default function App() {
    const [page, setPage] = useState('registration')
    const [collapsed, setCollapsed] = useState(false)
    const [pageKey, setPageKey] = useState(0)

    function navigateTo(id) {
        setPage(id)
        setPageKey(k => k + 1)
    }

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
            {/* SIDEBAR */}
            <aside
                style={{
                    width: collapsed ? 64 : 220,
                    minWidth: collapsed ? 64 : 220,
                    background: 'rgba(10,22,40,0.95)',
                    backdropFilter: 'blur(20px)',
                    borderRight: '1px solid rgba(0,212,189,0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '20px 8px',
                    transition: 'width 0.3s ease, min-width 0.3s ease',
                    position: 'relative',
                    zIndex: 50,
                    flexShrink: 0,
                }}
            >
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 24px', borderBottom: '1px solid rgba(0,212,189,0.1)', marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 900
                    }}>+</div>
                    {!collapsed && (
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1 }}>MediFlow</div>
                            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--accent-teal)', marginTop: 2 }}>Queue System v2.0</div>
                        </div>
                    )}
                </div>

                {/* Nav Links */}
                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {NAV_ITEMS.map(item => (
                        <div
                            key={item.id}
                            className={`sidebar-item${page === item.id ? ' active' : ''}`}
                            onClick={() => navigateTo(item.id)}
                            title={collapsed ? item.label : ''}
                            style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '12px' : '12px 16px' }}
                        >
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                            {!collapsed && <span>{item.label}</span>}
                        </div>
                    ))}
                </nav>

                {/* Collapse Button */}
                <button
                    onClick={() => setCollapsed(c => !c)}
                    style={{
                        marginTop: 16,
                        background: 'rgba(0,212,189,0.08)',
                        border: '1px solid rgba(0,212,189,0.2)',
                        borderRadius: 8,
                        color: 'var(--accent-teal)',
                        cursor: 'pointer',
                        padding: '10px',
                        fontSize: 14,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontFamily: 'IBM Plex Mono, monospace',
                    }}
                >
                    {collapsed ? '→' : '← Collapse'}
                </button>

                {/* Bottom info */}
                {!collapsed && (
                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,212,189,0.04)', borderRadius: 8, border: '1px solid rgba(0,212,189,0.1)' }}>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>CLINIC</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>MediFlow Clinic</div>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>Mumbai, Maharashtra</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                            <span className="pulse-dot teal" />
                            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--accent-teal)' }}>SYSTEM LIVE</span>
                        </div>
                    </div>
                )}
            </aside>

            {/* MAIN CONTENT */}
            <main key={pageKey} className="page-enter" style={{ flex: 1, overflow: 'hidden', height: '100vh' }}>
                {page === 'registration' && <PatientRegistration />}
                {page === 'queue' && <LiveQueueDisplay />}
                {page === 'doctor' && <DoctorDashboard />}
                {page === 'staff' && <StaffDashboard />}
            </main>
        </div>
    )
}
