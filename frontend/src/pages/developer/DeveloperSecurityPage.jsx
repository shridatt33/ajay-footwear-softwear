import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../../config'
import { useDeveloperAuth } from '../../context/DeveloperAuthContext'

export default function DeveloperSecurityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'audit'
  const { devToken } = useDeveloperAuth()

  const [auditLogs, setAuditLogs] = useState([])
  const [loginAttempts, setLoginAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchSecurityLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/security/logs?limit=150`, {
        headers: {
          Authorization: `Bearer ${devToken}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setAuditLogs(data.audit_logs || [])
        setLoginAttempts(data.login_attempts || [])
      } else {
        throw new Error(data.message)
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve security logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSecurityLogs()
  }, [devToken])

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      log.action?.toLowerCase().includes(term) ||
      log.username?.toLowerCase().includes(term) ||
      log.ip_address?.toLowerCase().includes(term) ||
      log.details?.toLowerCase().includes(term)
    )
  })

  const filteredLogins = loginAttempts.filter((att) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      att.username?.toLowerCase().includes(term) ||
      att.ip_address?.toLowerCase().includes(term) ||
      att.attempt_type?.toLowerCase().includes(term)
    )
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 className="dev-page-title">Security &amp; Audit Trail</h1>
          <p className="dev-page-desc">
            Immutable server-side audit logs of administrative actions, credential resets, and authentication vectors.
          </p>
        </div>

        <button className="dev-btn-sm" onClick={fetchSecurityLogs}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="dev-tabs-bar">
        <button
          className={`dev-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'audit' })}
        >
          Security Audit Logs ({auditLogs.length})
        </button>
        <button
          className={`dev-tab-btn ${activeTab === 'logins' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'logins' })}
        >
          Authentication Attempts ({loginAttempts.length})
        </button>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: '18px', maxWidth: '340px' }}>
        <input
          type="text"
          placeholder="Filter by action, user, or IP..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.86rem',
            background: '#ffffff',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* TAB 1: AUDIT LOGS TABLE */}
      {activeTab === 'audit' && (
        <div className="dev-table-wrap">
          <table className="dev-table">
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Timestamp</th>
                <th>User</th>
                <th>Action Code</th>
                <th>Details</th>
                <th>Origin IP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#b91c1c' }}>
                    {error}
                  </td>
                </tr>
              ) : filteredAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{log.username}</strong>
                    </td>
                    <td>
                      <span className={`dev-badge ${
                        log.action.includes('UNAUTHORIZED') || log.action.includes('BLOCKED') ? 'danger' :
                        log.action.includes('RESET') ? 'warning' : 'info'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#334155' }}>
                      {log.details || '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#475569' }}>
                      {log.ip_address}
                    </td>
                    <td>
                      <span className={`dev-badge ${
                        log.status === 'success' ? 'success' :
                        log.status === 'blocked' ? 'danger' : 'warning'
                      }`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: LOGIN ACTIVITY */}
      {activeTab === 'logins' && (
        <div className="dev-table-wrap">
          <table className="dev-table">
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Attempt Time</th>
                <th>Username</th>
                <th>Target Portal</th>
                <th>IP Address</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    Loading authentication attempts...
                  </td>
                </tr>
              ) : filteredLogins.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No authentication attempts recorded.
                  </td>
                </tr>
              ) : (
                filteredLogins.map((att) => (
                  <tr key={att.id}>
                    <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(att.attempt_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{att.username}</strong>
                    </td>
                    <td>
                      <span className={`dev-badge ${att.attempt_type === 'developer' ? 'info' : 'neutral'}`}>
                        {att.attempt_type.toUpperCase()} PORTAL
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {att.ip_address}
                    </td>
                    <td>
                      <span className={`dev-badge ${att.success ? 'success' : 'danger'}`}>
                        {att.success ? 'AUTHENTICATED' : 'REJECTED'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
