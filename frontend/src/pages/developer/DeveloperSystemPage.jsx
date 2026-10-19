import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../../config'
import { useDeveloperAuth } from '../../context/DeveloperAuthContext'

export default function DeveloperSystemPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'health'
  const { devToken } = useDeveloperAuth()

  const [diagnostics, setDiagnostics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDiagnostics = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/system`, {
        headers: {
          Authorization: `Bearer ${devToken}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setDiagnostics(data)
      } else {
        throw new Error(data.message)
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve system diagnostics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiagnostics()
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
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>Probing Host &amp; Database Health...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '20px', borderRadius: '12px', color: '#b91c1c' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700 }}>Diagnostics Error</h3>
        <p style={{ margin: '0 0 12px', fontSize: '0.86rem' }}>{error}</p>
        <button onClick={fetchDiagnostics} className="dev-btn-sm dev-btn-primary">
          Retry
        </button>
      </div>
    )
  }

  const { environment, database_diagnostics, configuration, system_errors } = diagnostics || {}

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 className="dev-page-title">System Diagnostics &amp; Health</h1>
          <p className="dev-page-desc">
            Direct host telemetry, PostgreSQL connection latency, and environmental integrity audits.
          </p>
        </div>

        <button
          className="dev-btn-sm"
          onClick={fetchDiagnostics}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          <span>Re-ping System</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="dev-tabs-bar">
        <button
          className={`dev-tab-btn ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'health' })}
        >
          System Health &amp; Runtime
        </button>
        <button
          className={`dev-tab-btn ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'database' })}
        >
          PostgreSQL Telemetry
        </button>
        <button
          className={`dev-tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'config' })}
        >
          Application Configuration
        </button>
      </div>

      {/* TAB 1: SYSTEM HEALTH */}
      {activeTab === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Metrics */}
          <div className="dev-stats-grid">
            <div className="dev-card">
              <span className="dev-card-title">DB Ping Latency</span>
              <div className="dev-card-value" style={{ color: '#16a34a', marginTop: '8px' }}>
                {database_diagnostics?.ping_latency_ms || 0} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>ms</span>
              </div>
              <div className="dev-card-meta">Roundtrip time (SELECT 1)</div>
            </div>

            <div className="dev-card">
              <span className="dev-card-title">Host Architecture</span>
              <div className="dev-card-value" style={{ fontSize: '1.25rem', marginTop: '8px' }}>
                {environment?.platform || 'Unknown'}
              </div>
              <div className="dev-card-meta">Node: {environment?.node_name}</div>
            </div>

            <div className="dev-card">
              <span className="dev-card-title">Python Environment</span>
              <div className="dev-card-value" style={{ fontSize: '1.25rem', marginTop: '8px' }}>
                Python {environment?.python_version || '3.x'}
              </div>
              <div className="dev-card-meta">Flask 3.1.3 &bull; Psycopg 3.3.6</div>
            </div>
          </div>

          {/* System Errors Table */}
          <div className="dev-table-wrap">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  Live System Errors ({system_errors?.length || 0})
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Real-time error trace captured in server memory
                </p>
              </div>
            </div>

            <table className="dev-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Error Description</th>
                </tr>
              </thead>
              <tbody>
                {system_errors && system_errors.length > 0 ? (
                  system_errors.map((err, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {new Date(err.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td>
                        <span className="dev-badge neutral">{err.method}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#b91c1c' }}>
                        {err.endpoint}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#334155' }}>
                        {err.error}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#15803d', padding: '32px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <strong>All Systems Operating Normally</strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                        No unhandled runtime errors have been logged.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DATABASE STATUS */}
      {activeTab === 'database' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dev-card">
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              PostgreSQL Engine Statistics (ajay_footwear)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Active DB Size
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                  {database_diagnostics?.size_mb} MB
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Committed Transactions
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d' }}>
                  {database_diagnostics?.stats?.commits?.toLocaleString() || 0}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Rollbacks
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#64748b' }}>
                  {database_diagnostics?.stats?.rollbacks?.toLocaleString() || 0}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Deadlocks Detected
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>
                  {database_diagnostics?.stats?.deadlocks || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: APPLICATION CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="dev-table-wrap">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Environment &amp; Directory Security Audit
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Sensitive parameters are masked; path access permissions verified
            </p>
          </div>

          <table className="dev-table">
            <thead>
              <tr>
                <th>Configuration Key</th>
                <th>Resolved Value</th>
                <th>Access / Status</th>
              </tr>
            </thead>
            <tbody>
              {configuration && Object.entries(configuration).map(([key, val]) => (
                <tr key={key}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                    {key}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {typeof val.value === 'string' ? val.value : JSON.stringify(val.value)}
                  </td>
                  <td>
                    {val.status ? (
                      <span className={`dev-badge ${val.status.includes('Protected') ? 'info' : 'success'}`}>
                        {val.status}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className={`dev-badge ${val.exists ? 'success' : 'danger'}`}>
                          {val.exists ? 'Directory Exists' : 'Missing'}
                        </span>
                        <span className={`dev-badge ${val.writable ? 'success' : 'warning'}`}>
                          {val.writable ? 'Writable' : 'Read-only'}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
