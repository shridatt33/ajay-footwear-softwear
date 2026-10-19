import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../../config'
import { useDeveloperAuth } from '../../context/DeveloperAuthContext'

export default function DeveloperOverviewPage() {
  const { devToken } = useDeveloperAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchOverview = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/overview`, {
        headers: {
          Authorization: `Bearer ${devToken}`,
        },
      })
      if (!res.ok) {
        throw new Error(`Failed to load system metrics (HTTP ${res.status})`)
      }
      const json = await res.json()
      if (json.success) {
        setData(json)
      } else {
        throw new Error(json.message || 'Error parsing overview payload')
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to Developer API')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOverview()
  }, [devToken])

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
        <div style={{
          width: '32px',
          height: '32px',
          margin: '0 auto 16px',
          border: '3px solid #e2e8f0',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'devSpin 0.8s linear infinite'
        }} />
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>Polling Real Telemetry from Backend...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        padding: '24px',
        color: '#b91c1c',
        maxWidth: '600px'
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700 }}>Telemetry Error</h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.86rem' }}>{error}</p>
        <button
          onClick={fetchOverview}
          className="dev-btn-sm dev-btn-primary"
        >
          Retry Connection
        </button>
      </div>
    )
  }

  const { application, database, users, store_metrics, recent_logins, recent_errors, last_backup } = data || {}

  return (
    <div>
      {/* Page Title & Subtitle */}
      <div className="dev-page-header">
        <h1 className="dev-page-title">Operations &amp; System Telemetry</h1>
        <p className="dev-page-desc">
          Live real-time monitoring of PostgreSQL instance, authorized shop accounts, and system integrity.
        </p>
      </div>

      {/* Top Level Metric Cards */}
      <div className="dev-stats-grid">
        {/* Card 1: Application Health */}
        <div className="dev-card">
          <div className="dev-card-header">
            <span className="dev-card-title">Backend Status</span>
            <div className="dev-card-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>
          <div className="dev-card-value" style={{ color: '#15803d', fontSize: '1.5rem' }}>
            {application?.status || 'Active'}
          </div>
          <div className="dev-card-meta">
            <span>Uptime:</span>
            <strong style={{ color: '#0f172a' }}>{application?.uptime_formatted || 'Online'}</strong>
          </div>
        </div>

        {/* Card 2: Database Size & Engine */}
        <div className="dev-card">
          <div className="dev-card-header">
            <span className="dev-card-title">PostgreSQL Storage</span>
            <div className="dev-card-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </div>
          </div>
          <div className="dev-card-value">
            {database?.size_mb || 0} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>MB</span>
          </div>
          <div className="dev-card-meta">
            <span>Connections:</span>
            <strong style={{ color: '#0f172a' }}>{database?.active_connections || 1} active</strong>
            &bull;
            <span>{database?.database_name}</span>
          </div>
        </div>

        {/* Card 3: Authorized Shop Users */}
        <div className="dev-card">
          <div className="dev-card-header">
            <span className="dev-card-title">Shop Accounts</span>
            <div className="dev-card-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>
          <div className="dev-card-value">
            {users?.total_shop_users || 0}
          </div>
          <div className="dev-card-meta">
            <span style={{ color: '#15803d', fontWeight: 600 }}>{users?.active_shop_users || 0} active</span>
            &bull;
            <span style={{ color: users?.inactive_shop_users > 0 ? '#b91c1c' : '#64748b' }}>
              {users?.inactive_shop_users || 0} disabled
            </span>
          </div>
        </div>

        {/* Card 4: Last Successful Backup */}
        <div className="dev-card">
          <div className="dev-card-header">
            <span className="dev-card-title">Last System Backup</span>
            <div className="dev-card-icon" style={{ background: '#ede9fe', color: '#6d28d9' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
          </div>
          <div className="dev-card-value" style={{ fontSize: '1.25rem' }}>
            {last_backup ? `${last_backup.size_mb} MB` : 'No Backup'}
          </div>
          <div className="dev-card-meta">
            {last_backup ? (
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {new Date(last_backup.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            ) : (
              <span style={{ color: '#b45309' }}>Run initial backup</span>
            )}
          </div>
        </div>
      </div>

      {/* Retail Store Context Summary (Real DB counts) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '20px 24px',
        marginBottom: '26px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
            SWAMIDATT FOOTWEAR Database Payload
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
            Live record volume stored across core business tables
          </p>
        </div>

        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
              Catalog Products
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              {store_metrics?.products || 0}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
              Stock Units
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb' }}>
              {store_metrics?.stock_units || 0}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
              Sales Bills
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              {store_metrics?.bills || 0}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
              Customers
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              {store_metrics?.customers || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Recent Login Activity vs Recent Errors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* Recent Login Activity */}
        <div className="dev-table-wrap">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Recent Authentication Attempts
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Both shop terminal &amp; developer attempts
              </p>
            </div>
            <Link to="/developer/security?tab=logins" className="dev-btn-sm">
              View All Logs
            </Link>
          </div>

          <table className="dev-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Channel</th>
                <th>IP Address</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recent_logins && recent_logins.length > 0 ? (
                recent_logins.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{item.username}</td>
                    <td>
                      <span className={`dev-badge ${item.attempt_type === 'developer' ? 'info' : 'neutral'}`}>
                        {item.attempt_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.ip_address}</td>
                    <td>
                      <span className={`dev-badge ${item.success ? 'success' : 'danger'}`}>
                        {item.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {item.time ? new Date(item.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                    No recorded authentication attempts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* System Error Stream */}
        <div className="dev-table-wrap">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Recent System Errors Buffer
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Real exceptions caught by backend telemetry
              </p>
            </div>
            <Link to="/developer/system?tab=health" className="dev-btn-sm">
              Diagnostics
            </Link>
          </div>

          <table className="dev-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Method</th>
                <th>Error Snippet</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recent_errors && recent_errors.length > 0 ? (
                recent_errors.map((err, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#b91c1c' }}>
                      {err.endpoint || '/'}
                    </td>
                    <td>
                      <span className="dev-badge neutral">{err.method || 'GET'}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={err.error}>
                      {err.error}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {new Date(err.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#15803d', padding: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span style={{ fontWeight: 600 }}>Zero active errors logged in memory buffer.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
