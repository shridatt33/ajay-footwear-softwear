import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../../config'
import { useDeveloperAuth } from '../../context/DeveloperAuthContext'

export default function DeveloperSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'backups'
  const { devToken } = useDeveloperAuth()

  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  // Restore Modal State
  const [restoreModalFile, setRestoreModalFile] = useState(null)
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [restoring, setRestoring] = useState(false)

  const fetchBackups = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/backups`, {
        headers: {
          Authorization: `Bearer ${devToken}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setBackups(data.backups || [])
      } else {
        throw new Error(data.message)
      }
    } catch (err) {
      setError(err.message || 'Failed to load backup archives')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBackups()
  }, [devToken])

  const handleCreateBackup = async () => {
    setCreatingBackup(true)
    setStatusMessage('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/backups`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message)

      setStatusMessage(`Backup generated successfully: ${data.backup?.filename}`)
      fetchBackups()
    } catch (err) {
      alert(`Backup creation failed: ${err.message}`)
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleRestore = async (e) => {
    e.preventDefault()
    if (!restoreModalFile) return
    if (confirmPhrase.trim() !== 'RESTORE') {
      alert("Please type 'RESTORE' in all capital letters to confirm.")
      return
    }

    setRestoring(true)
    try {
      const res = await fetch(`${API_BASE_URL}/developer/backups/restore`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: restoreModalFile.filename,
          confirm_restore: true,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message)

      alert(`Restoration complete! ${data.message}`)
      setRestoreModalFile(null)
      setConfirmPhrase('')
      setStatusMessage(`System restored from snapshot: ${restoreModalFile.filename}`)
      fetchBackups()
    } catch (err) {
      alert(`Restoration failed: ${err.message}`)
    } finally {
      setRestoring(false)
    }
  }

  const handleDownload = (filename) => {
    window.open(`${API_BASE_URL}/developer/backups/download/${encodeURIComponent(filename)}?token=${devToken}`, '_blank')
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 className="dev-page-title">Disaster Recovery &amp; Developer Console</h1>
          <p className="dev-page-desc">
            Perform safe, structured database snapshot exports, restore operational states, and tune developer security policies.
          </p>
        </div>

        {activeTab === 'backups' && (
          <button
            className="dev-btn-sm dev-btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.84rem' }}
            onClick={handleCreateBackup}
            disabled={creatingBackup}
          >
            {creatingBackup ? (
              <>
                <span className="dev-spinner" style={{ width: 14, height: 14 }} />
                <span>Exporting Snapshot...</span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Initiate Manual Backup</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="dev-tabs-bar">
        <button
          className={`dev-tab-btn ${activeTab === 'backups' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'backups' })}
        >
          Backup &amp; Recovery Archives ({backups.length})
        </button>
        <button
          className={`dev-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'settings' })}
        >
          Developer Console Settings
        </button>
      </div>

      {statusMessage && (
        <div style={{
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.86rem',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage('')}
            style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 'bold' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* TAB 1: BACKUPS ARCHIVE */}
      {activeTab === 'backups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dev-table-wrap">
            <table className="dev-table">
              <thead>
                <tr>
                  <th>Archive Filename</th>
                  <th>Snapshot Size</th>
                  <th>Trigger Mode</th>
                  <th>Created By</th>
                  <th>Timestamp</th>
                  <th>Disk Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      Inspecting backup repository...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#b91c1c' }}>
                      {error}
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No backup snapshots found. Click &quot;Initiate Manual Backup&quot; to create the first snapshot.
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                        {b.filename}
                      </td>
                      <td style={{ fontWeight: 600 }}>{b.file_size_formatted}</td>
                      <td>
                        <span className="dev-badge neutral">{b.backup_type?.toUpperCase()}</span>
                      </td>
                      <td>{b.created_by || 'system'}</td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {new Date(b.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        <span className={`dev-badge ${b.disk_verified ? 'success' : 'danger'}`}>
                          {b.disk_verified ? 'Verified on Disk' : 'Missing File'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="dev-btn-sm"
                            onClick={() => handleDownload(b.filename)}
                            title="Download JSON Snapshot"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            className="dev-btn-sm dev-btn-danger"
                            onClick={() => {
                              setRestoreModalFile(b)
                              setConfirmPhrase('')
                            }}
                            title="Restore database to this state"
                          >
                            Restore...
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '18px 22px',
            fontSize: '0.84rem',
            color: '#475569',
            lineHeight: 1.5
          }}>
            <h4 style={{ margin: '0 0 6px', color: '#0f172a', fontWeight: 700 }}>
              Disaster Recovery Storage Security Notice
            </h4>
            Snapshots are serialized as complete transactional JSON bundles and written directly to <code>backend/backups/</code> on the host filesystem. They are stored strictly outside public web roots and protected against arbitrary execution.
          </div>
        </div>
      )}

      {/* TAB 2: DEVELOPER SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
          <div className="dev-card">
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Authentication &amp; Session Policies
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#64748b' }}>
              Enforced server-side for all Developer Super Admin requests.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <strong>Session Expiration Window</strong>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Developer tokens expire automatically</div>
                </div>
                <span className="dev-badge info">8 Hours</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <strong>Brute-Force Lockout Threshold</strong>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Consecutive failed attempts before IP quarantine</div>
                </div>
                <span className="dev-badge warning">5 Attempts / 15 Minutes</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <strong>Password Hashing Algorithm</strong>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Cryptographic memory-hard key derivation</div>
                </div>
                <span className="dev-badge success">Werkzeug / Scrypt</span>
              </div>
            </div>
          </div>

          <div className="dev-card">
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              CLI Account Provisioning
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.84rem', color: '#64748b' }}>
              To provision or rotate the primary developer super admin credentials from the command line:
            </p>
            <pre style={{
              background: '#080f24',
              color: '#38bdf8',
              padding: '14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              overflowX: 'auto',
              margin: 0
            }}>
cd &quot;backend&quot;
.\venv\Scripts\python.exe create_dev_admin.py --username dev_admin --name &quot;Lead Developer&quot;
            </pre>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {restoreModalFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.35)',
            border: '2px solid #ef4444'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', marginBottom: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                High-Impact Database Restore
              </h2>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
              Restoring from snapshot <strong>{restoreModalFile.filename}</strong> will overwrite current tables in <code>ajay_footwear</code>. Current products, sales bills, and customers will be synchronized back to the state of this snapshot.
            </p>

            <form onSubmit={handleRestore} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Type <span style={{ color: '#dc2626' }}>RESTORE</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  placeholder="RESTORE"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '2px solid #f87171',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  className="dev-btn-sm"
                  onClick={() => setRestoreModalFile(null)}
                  disabled={restoring}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dev-btn-sm dev-btn-danger"
                  disabled={restoring || confirmPhrase !== 'RESTORE'}
                >
                  {restoring ? 'Executing Restoration...' : 'Execute Recovery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
