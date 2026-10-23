import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../../config'
import { useDeveloperAuth } from '../../context/DeveloperAuthContext'

export default function DeveloperUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'accounts'
  const { devToken, devUser } = useDeveloperAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')

  // 1. Create Shop Account Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    shop_name: '',
    username: '',
    password: '',
    full_name: '',
    role: 'Admin',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
  })
  const [createSubmitting, setCreateSubmitting] = useState(false)

  // 2. Edit Shop Details Modal
  const [editModalUser, setEditModalUser] = useState(null)
  const [editForm, setEditForm] = useState({
    shop_name: '',
    full_name: '',
    role: 'Admin',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
    status: 'active',
  })
  const [editSubmitting, setEditSubmitting] = useState(false)

  // 3. Set or Reset Credentials Modal
  const [credentialsModalUser, setCredentialsModalUser] = useState(null)
  const [newCredUsername, setNewCredUsername] = useState('')
  const [newCredPassword, setNewCredPassword] = useState('')
  const [generatedPassResult, setGeneratedPassResult] = useState('')
  const [credentialsSubmitting, setCredentialsSubmitting] = useState(false)

  // 4. Stop / Resume Billing Confirmation Modal
  const [billingConfirmUser, setBillingConfirmUser] = useState(null)
  const [targetBillingStatus, setTargetBillingStatus] = useState('suspended')
  const [billingSubmitting, setBillingSubmitting] = useState(false)

  // 5. Safe Deletion & Compliance Archival Modal
  const [deleteModalUser, setDeleteModalUser] = useState(null)
  const [deleteConfirmNameInput, setDeleteConfirmNameInput] = useState('')
  const [deleteAcknowledgePolicy, setDeleteAcknowledgePolicy] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/users`, {
        headers: {
          Authorization: `Bearer ${devToken}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
      } else {
        throw new Error(data.message)
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [devToken])

  // Clear alerts after 8 seconds
  useEffect(() => {
    if (actionSuccess || actionError) {
      const t = setTimeout(() => {
        setActionSuccess('')
        setActionError('')
      }, 8000)
      return () => clearTimeout(t)
    }
  }, [actionSuccess, actionError])

  // Handler: Create Shop Account
  const handleCreateShopAccount = async (e) => {
    e.preventDefault()
    setCreateSubmitting(true)
    setActionError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to create shop account')

      setShowCreateModal(false)
      setCreateForm({
        shop_name: '',
        username: '',
        password: '',
        full_name: '',
        role: 'Admin',
        phone: '',
        email: '',
        address: '',
        gst_number: '',
      })
      setActionSuccess(data.message || 'Shop account created successfully.')
      fetchUsers()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Handler: Open Edit Modal
  const openEditModal = (u) => {
    setEditModalUser(u)
    setEditForm({
      shop_name: u.shop_name || '',
      full_name: u.full_name || '',
      role: u.role || 'Admin',
      phone: u.phone || '',
      email: u.email || '',
      address: u.address || '',
      gst_number: u.gst_number || '',
      status: u.status || 'active',
    })
  }

  // Handler: Save Edit Details
  const handleSaveEditDetails = async (e) => {
    e.preventDefault()
    if (!editModalUser) return
    setEditSubmitting(true)
    setActionError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/users/${editModalUser.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update shop details')

      setEditModalUser(null)
      setActionSuccess(data.message || 'Shop details updated.')
      fetchUsers()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  // Handler: Open Credentials Modal
  const openCredentialsModal = (u) => {
    setCredentialsModalUser(u)
    setNewCredUsername(u.username || '')
    setNewCredPassword('')
    setGeneratedPassResult('')
  }

  // Handler: Save Credentials
  const handleSaveCredentials = async (e) => {
    e.preventDefault()
    if (!credentialsModalUser) return
    setCredentialsSubmitting(true)
    setActionError('')
    try {
      const payload = {}
      if (newCredUsername.trim() && newCredUsername.trim() !== credentialsModalUser.username) {
        payload.username = newCredUsername.trim()
      }
      if (newCredPassword.trim()) {
        payload.password = newCredPassword.trim()
      }

      if (Object.keys(payload).length === 0) {
        throw new Error('Please modify username or provide a new password.')
      }

      const res = await fetch(`${API_BASE_URL}/developer/users/${credentialsModalUser.id}/credentials`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update credentials')

      setCredentialsModalUser(null)
      setActionSuccess(data.message || 'Login credentials updated and active sessions revoked.')
      fetchUsers()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setCredentialsSubmitting(false)
    }
  }

  // Handler: Open Billing Suspension Confirmation
  const openBillingConfirm = (user, statusToSet) => {
    setBillingConfirmUser(user)
    setTargetBillingStatus(statusToSet)
  }

  // Handler: Execute Billing Suspension / Resumption
  const handleExecuteBillingStatus = async () => {
    if (!billingConfirmUser) return
    setBillingSubmitting(true)
    setActionError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/users/${billingConfirmUser.id}/billing-status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ billing_status: targetBillingStatus }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update billing status')

      setBillingConfirmUser(null)
      setActionSuccess(data.message)
      fetchUsers()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBillingSubmitting(false)
    }
  }

  // Handler: Open Delete Confirmation
  const openDeleteModal = (u) => {
    setDeleteModalUser(u)
    setDeleteConfirmNameInput('')
    setDeleteAcknowledgePolicy(false)
    setDeleteError('')
  }

  // Handler: Execute Safe Deletion or Compliance Archival
  const handleExecuteDeleteAccount = async () => {
    if (!deleteModalUser) return
    setDeleteSubmitting(true)
    setDeleteError('')
    setActionError('')
    try {
      const res = await fetch(`${API_BASE_URL}/developer/users/${deleteModalUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${devToken}`,
        },
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to delete account')

      setDeleteModalUser(null)
      setActionSuccess(data.message || 'Shop account permanently deleted.')
      await fetchUsers()
    } catch (err) {
      setDeleteError(err.message)
      setActionError(err.message)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 className="dev-page-title">Shop Accounts &amp; Billing Management</h1>
          <p className="dev-page-desc">
            Manage client shops, provision operator credentials, enforce POS billing suspensions, and manage statutory retention accounts.
          </p>
        </div>

        {activeTab === 'accounts' && (
          <button
            className="dev-btn-sm dev-btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.84rem' }}
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create New Shop Account</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="dev-tabs-bar">
        <button
          className={`dev-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'accounts' })}
        >
          Customer &amp; Shop Accounts ({users.length})
        </button>
        <button
          className={`dev-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'roles' })}
        >
          Role &amp; Privilege Matrix
        </button>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div style={{
          background: '#dcfce7',
          border: '1px solid #86efac',
          borderLeft: '5px solid #16a34a',
          color: '#15803d',
          padding: '12px 18px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess('')}
            style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {actionError && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderLeft: '5px solid #dc2626',
          color: '#991b1b',
          padding: '12px 18px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError('')}
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* TAB 1: ACCOUNTS TABLE */}
      {activeTab === 'accounts' && (
        <div className="dev-table-wrap">
          <table className="dev-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>ID</th>
                <th>Shop / Organization</th>
                <th>Username</th>
                <th>Account Status</th>
                <th>Billing Status</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Invoices</th>
                <th style={{ textAlign: 'right', minWidth: '220px' }}>Available Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading shop accounts from PostgreSQL database...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#b91c1c' }}>
                    {error}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No shop accounts registered in database.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrentDev = u.id === devUser?.id
                  const isDevRole = u.role === 'developer_super_admin'
                  const isSuspended = u.billing_status === 'suspended'
                  const isArchived = u.status === 'archived'

                  return (
                    <tr key={u.id} style={isArchived ? { opacity: 0.75, background: '#f8fafc' } : {}}>
                      <td style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.8rem' }}>#{u.id}</td>

                      {/* Shop Name */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                          {u.shop_name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                          {u.full_name}{u.phone ? ` • ${u.phone}` : ''}
                        </div>
                      </td>

                      {/* Username */}
                      <td>
                        <strong style={{ color: '#1e293b', fontFamily: 'monospace', fontSize: '0.86rem' }}>
                          {u.username}
                        </strong>
                        {isCurrentDev && (
                          <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: '#2563eb', fontWeight: 700 }}>
                            (YOU)
                          </span>
                        )}
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Role: {u.role}
                        </div>
                      </td>

                      {/* Account Status Badge */}
                      <td>
                        <span
                          className="dev-badge"
                          style={{
                            background:
                              u.status === 'active' ? '#dcfce7' :
                                u.status === 'archived' ? '#f1f5f9' : '#fee2e2',
                            color:
                              u.status === 'active' ? '#15803d' :
                                u.status === 'archived' ? '#475569' : '#b91c1c',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            border: `1px solid ${u.status === 'active' ? '#86efac' :
                                u.status === 'archived' ? '#cbd5e1' : '#fca5a5'
                              }`
                          }}
                        >
                          {u.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Billing Status Badge (Active: Green, Suspended: Red/Orange) */}
                      <td>
                        <span
                          className="dev-badge"
                          style={{
                            background: isSuspended ? '#fee2e2' : '#ecfdf5',
                            color: isSuspended ? '#dc2626' : '#059669',
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.74rem',
                            border: `1px solid ${isSuspended ? '#f87171' : '#a7f3d0'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isSuspended ? '#dc2626' : '#059669',
                            display: 'inline-block'
                          }} />
                          {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                        </span>
                      </td>

                      {/* Creation Date */}
                      <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : '—'}
                      </td>

                      {/* Last Login / Active Sessions */}
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        <div>{u.last_active ? new Date(u.last_active).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}</div>
                        {u.active_sessions > 0 ? (
                          <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.72rem' }}>
                            {u.active_sessions} active session(s)
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Offline</span>
                        )}
                      </td>

                      {/* Invoices Count */}
                      <td style={{ textAlign: 'center', fontSize: '0.84rem' }}>
                        <span style={{ fontWeight: 700, color: u.total_bills > 0 ? '#0f172a' : '#94a3b8' }}>
                          {u.total_bills}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {/* Edit Shop Details */}
                          <button
                            type="button"
                            className="dev-btn-sm"
                            title="Edit Shop Details"
                            onClick={() => openEditModal(u)}
                          >
                            Edit
                          </button>

                          {/* Set or Reset Login Credentials */}
                          <button
                            type="button"
                            className="dev-btn-sm"
                            title="Set or reset login credentials"
                            onClick={() => openCredentialsModal(u)}
                          >
                            Credentials
                          </button>

                          {/* Billing Suspension Controls */}
                          {!isDevRole && (
                            <>
                              {isSuspended ? (
                                <button
                                  type="button"
                                  className="dev-btn-sm"
                                  style={{
                                    background: '#ecfdf5',
                                    borderColor: '#10b981',
                                    color: '#047857',
                                    fontWeight: 700
                                  }}
                                  title="Resume billing access for this shop"
                                  onClick={() => openBillingConfirm(u, 'active')}
                                >
                                  Resume Billing
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="dev-btn-sm"
                                  style={{
                                    background: '#fff1f2',
                                    borderColor: '#f43f5e',
                                    color: '#be123c',
                                    fontWeight: 700
                                  }}
                                  title="Stop and suspend POS billing for this shop"
                                  onClick={() => openBillingConfirm(u, 'suspended')}
                                >
                                  Stop Billing
                                </button>
                              )}

                              {/* Delete Shop Account */}
                              <button
                                type="button"
                                className="dev-btn-sm dev-btn-danger"
                                style={{ padding: '4px 8px' }}
                                title="Delete or Archive Shop Account"
                                onClick={() => openDeleteModal(u)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: ROLE & PRIVILEGE MATRIX */}
      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dev-table-wrap">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                Application Privilege &amp; Access Control Matrix
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                System-enforced capabilities across the SWAMIDATT ENTERPRISES ERP and Developer Admin systems.
              </p>
            </div>
            <table className="dev-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Primary Portal</th>
                  <th>POS Billing</th>
                  <th>Inventory / Stock</th>
                  <th>Customer Ledger</th>
                  <th>Billing Suspension</th>
                  <th>Developer Super Admin</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="dev-badge info">developer_super_admin</span>
                  </td>
                  <td>
                    <strong>Developer Portal (/#/developer-access)</strong>
                  </td>
                  <td>Read / Audit</td>
                  <td>Full System Audit</td>
                  <td>Full System Audit</td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>Master Control</span>
                  </td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>Exclusive Access</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="dev-badge warning">Admin</span>
                  </td>
                  <td>
                    <strong>Shop Terminal (/#/dashboard)</strong>
                  </td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>Full (if active)</span>
                  </td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>Full</span>
                  </td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>Full</span>
                  </td>
                  <td>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>Subject to Policy</span>
                  </td>
                  <td>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>Blocked (403)</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="dev-badge neutral">Manager</span>
                  </td>
                  <td>
                    <strong>Shop Terminal (/#/dashboard)</strong>
                  </td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>Full (if active)</span>
                  </td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>Full</span>
                  </td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>Full</span>
                  </td>
                  <td>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>Subject to Policy</span>
                  </td>
                  <td>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>Blocked (403)</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="dev-badge neutral">Cashier</span>
                  </td>
                  <td>
                    <strong>Shop Terminal (/#/billing)</strong>
                  </td>
                  <td>
                    <span style={{ color: '#15803d', fontWeight: 700 }}>POS Only (if active)</span>
                  </td>
                  <td>Read Only</td>
                  <td>
                    <span style={{ color: '#dc2626' }}>None</span>
                  </td>
                  <td>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>Subject to Policy</span>
                  </td>
                  <td>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>Blocked (403)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------
          MODAL 1: CREATE NEW SHOP ACCOUNT
          ------------------------------------------------------------------- */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Create New Shop Account
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '0.84rem', color: '#64748b' }}>
              Provision an authenticated shop terminal account with credentials and billing privileges.
            </p>

            <form onSubmit={handleCreateShopAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Shop / Store Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SWAMIDATT ENTERPRISES - Solapur Branch"
                  value={createForm.shop_name}
                  onChange={(e) => setCreateForm({ ...createForm, shop_name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. solapur_admin"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Initial Password (min 6 chars) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Set strong initial password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Store Manager / Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Patil"
                    value={createForm.full_name}
                    onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Role Assignment
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="Admin">Shop Admin (Managerial)</option>
                    <option value="Manager">Store Manager</option>
                    <option value="Cashier">Terminal Cashier (POS)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Phone / Mobile
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 7020466300"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. solapur@swamidatt.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Shop Address / Location
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, City, Pin Code"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  GSTIN Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={createForm.gst_number}
                  onChange={(e) => setCreateForm({ ...createForm, gst_number: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="dev-btn-sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dev-btn-sm dev-btn-primary"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? 'Creating Shop Account...' : 'Create Shop Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------
          MODAL 2: EDIT SHOP DETAILS
          ------------------------------------------------------------------- */}
      {editModalUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '540px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Edit Shop Details: {editModalUser.shop_name}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '0.84rem', color: '#64748b' }}>
              Update business identity, contact information, role, and operational status.
            </p>

            <form onSubmit={handleSaveEditDetails} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.shop_name}
                  onChange={(e) => setEditForm({ ...editForm, shop_name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Manager / Contact Name
                  </label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    disabled={editModalUser.role === 'developer_super_admin'}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    {editModalUser.role === 'developer_super_admin' ? (
                      <option value="developer_super_admin">Developer Super Admin</option>
                    ) : (
                      <>
                        <option value="Admin">Shop Admin (Managerial)</option>
                        <option value="Manager">Store Manager</option>
                        <option value="Cashier">Terminal Cashier (POS)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Address
                </label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={editForm.gst_number}
                    onChange={(e) => setEditForm({ ...editForm, gst_number: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Account Login Status
                  </label>
                  <select
                    value={editForm.status}
                    disabled={editModalUser.role === 'developer_super_admin'}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="active">Active (Login Allowed)</option>
                    <option value="inactive">Inactive (Deactivated)</option>
                    {editModalUser.status === 'archived' && (
                      <option value="archived">Archived (Retention)</option>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="dev-btn-sm"
                  onClick={() => setEditModalUser(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dev-btn-sm dev-btn-primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------
          MODAL 3: SET OR RESET CREDENTIALS
          ------------------------------------------------------------------- */}
      {credentialsModalUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
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
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Set / Reset Login Credentials
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#64748b' }}>
              Update username and reset password for <strong>{credentialsModalUser.shop_name}</strong>.
            </p>

            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#1e40af',
              marginBottom: '16px'
            }}>
              🔒 <strong>Security Enforcement:</strong> Updating login credentials immediately revokes all active browser and terminal sessions for this shop.
            </div>

            <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newCredUsername}
                  onChange={(e) => setNewCredUsername(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  New Password (leave empty to keep unchanged)
                </label>
                <input
                  type="text"
                  placeholder="Enter new password (min 6 characters)"
                  value={newCredPassword}
                  onChange={(e) => setNewCredPassword(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="dev-btn-sm"
                  onClick={() => setCredentialsModalUser(null)}
                  disabled={credentialsSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dev-btn-sm dev-btn-primary"
                  disabled={credentialsSubmitting}
                >
                  {credentialsSubmitting ? 'Updating Credentials...' : 'Save Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------
          MODAL 4: STOP / RESUME BILLING CONFIRMATION
          ------------------------------------------------------------------- */}
      {billingConfirmUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          }}>
            <h2 style={{
              margin: '0 0 10px',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: targetBillingStatus === 'suspended' ? '#b91c1c' : '#15803d'
            }}>
              {targetBillingStatus === 'suspended' ? '⚠️ Stop Billing Operations?' : '✓ Resume Billing Operations?'}
            </h2>

            <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5, marginBottom: '20px' }}>
              {targetBillingStatus === 'suspended' ? (
                <>
                  You are about to <strong>STOP BILLING</strong> for <strong>{billingConfirmUser.shop_name}</strong> (Username: <code>{billingConfirmUser.username}</code>).
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: '#991b1b'
                  }}>
                    <strong>Enforced Effects:</strong>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      <li>New invoice creation and POS checkout will be completely blocked.</li>
                      <li>Direct API requests to billing checkout will return <code>HTTP 403 Forbidden</code>.</li>
                      <li>Active sessions are purged to prevent stale operations.</li>
                      <li>Existing invoices, products, and customer balances remain preserved.</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  Resume billing for <strong>{billingConfirmUser.shop_name}</strong>.
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: '#166534'
                  }}>
                    <strong>Restored Privileges:</strong>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      <li>Shop operators will immediately be permitted to create invoices and complete sales.</li>
                      <li>The POS warning banner will be removed.</li>
                      <li>The resumption action will be logged in security audit logs.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="dev-btn-sm"
                onClick={() => setBillingConfirmUser(null)}
                disabled={billingSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`dev-btn-sm ${targetBillingStatus === 'suspended' ? 'dev-btn-danger' : 'dev-btn-primary'}`}
                style={targetBillingStatus === 'active' ? { background: '#16a34a', borderColor: '#15803d' } : {}}
                onClick={handleExecuteBillingStatus}
                disabled={billingSubmitting}
              >
                {billingSubmitting
                  ? 'Updating Status...'
                  : targetBillingStatus === 'suspended'
                    ? 'Confirm Stop Billing'
                    : 'Confirm Resume Billing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------
          MODAL 5: PERMANENT SHOP ACCOUNT DELETION & STATUTORY PRESERVATION
          ------------------------------------------------------------------- */}
      {deleteModalUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '540px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.6rem' }}>🚨</span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>
                Permanently Delete Shop Account
              </h2>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#64748b' }}>
              Account to be deleted: <strong style={{ color: '#0f172a' }}>{deleteModalUser.username}</strong> ({deleteModalUser.shop_name}, Account ID: {deleteModalUser.id})
            </p>

            {/* Retention Notice Box */}
            <div style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '0.82rem',
              color: '#9f1239',
              lineHeight: 1.5
            }}>
              <strong>Statutory Accounting &amp; Record Preservation Guarantee:</strong>
              <div style={{ marginTop: '6px' }}>
                In accordance with statutory accounting and tax regulations, existing invoices and financial history are <strong>never destroyed</strong>.
                {deleteModalUser.total_bills > 0 ? (
                  <div style={{ marginTop: '4px', color: '#881337', fontWeight: 600 }}>
                    All {deleteModalUser.total_bills} invoice(s) associated with this account are safely detached and preserved in the historical accounting ledger.
                  </div>
                ) : (
                  <div style={{ marginTop: '4px', color: '#881337' }}>
                    0 invoices are associated with this user.
                  </div>
                )}
                <div style={{ marginTop: '4px', color: '#881337' }}>
                  The account credentials and user record will be <strong>permanently deleted from PostgreSQL</strong>, and all active sessions will be revoked.
                </div>
              </div>
            </div>

            {/* In-Modal Error Display */}
            {deleteError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '14px',
                lineHeight: 1.4
              }}>
                <strong>Error:</strong> {deleteError}
              </div>
            )}

            {/* Step 1: Confirm by typing exact username */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Please type username <strong style={{ color: '#0f172a' }}>{deleteModalUser.username}</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmNameInput}
                onChange={(e) => setDeleteConfirmNameInput(e.target.value)}
                placeholder={`Type "${deleteModalUser.username}" to confirm`}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>

            {/* Step 2: Acknowledgment Checkbox */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteAcknowledgePolicy}
                  onChange={(e) => setDeleteAcknowledgePolicy(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I understand this action is permanent, will revoke all active sessions immediately, and cannot be undone.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="dev-btn-sm"
                onClick={() => setDeleteModalUser(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dev-btn-sm dev-btn-danger"
                disabled={
                  deleteSubmitting ||
                  deleteConfirmNameInput.trim().toLowerCase() !== deleteModalUser.username.trim().toLowerCase() ||
                  !deleteAcknowledgePolicy
                }
                onClick={handleExecuteDeleteAccount}
              >
                {deleteSubmitting
                  ? 'Permanently Deleting...'
                  : 'Permanently Delete Shop Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
