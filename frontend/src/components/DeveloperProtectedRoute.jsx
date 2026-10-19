import { Navigate, Outlet } from 'react-router-dom'
import { useDeveloperAuth } from '../context/DeveloperAuthContext'

export default function DeveloperProtectedRoute() {
  const { isDevAuthenticated, isDevLoading } = useDeveloperAuth()

  if (isDevLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#070d1e',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          padding: '36px 44px',
          background: 'rgba(15, 23, 42, 0.85)',
          borderRadius: '16px',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(37, 99, 235, 0.15)',
          backdropFilter: 'blur(12px)',
          textAlign: 'center',
          maxWidth: '360px',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(37, 99, 235, 0.5)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.15em', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>
              SWAMIDATT CONTROL
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: '4px 0 0' }}>
              Verifying Developer Privileges
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '6px 0 0' }}>
              Validating cryptographic token...
            </p>
          </div>
          <div style={{
            width: '30px',
            height: '30px',
            border: '3px solid rgba(59, 130, 246, 0.2)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'devSpin 0.75s linear infinite',
          }} />
        </div>
        <style>{`
          @keyframes devSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!isDevAuthenticated) {
    return <Navigate to="/developer-access" replace />
  }

  return <Outlet />
}
