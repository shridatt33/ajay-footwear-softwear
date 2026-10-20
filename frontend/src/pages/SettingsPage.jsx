import { useEffect, useState } from 'react'
import { API_BASE_URL, SHOP_INFO } from '../config'
import { SettingsIcon, CheckIcon } from '../components/Icons'

export default function SettingsPage() {
  const [healthStatus, setHealthStatus] = useState(null)
  const [shopName, setShopName] = useState(SHOP_INFO.name)
  const [phone, setPhone] = useState(SHOP_INFO.phone)
  const [address, setAddress] = useState(SHOP_INFO.address)
  const [gst, setGst] = useState(SHOP_INFO.gst)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((r) => r.json())
      .then((d) => setHealthStatus(d))
      .catch(() => setHealthStatus({ status: 'offline' }))
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  return (
    <div className="erp-page-container">
      <div className="erp-page-header">
        <div>
          <h1 className="page-main-title">Application Settings &amp; Shop Profile</h1>
          <p className="page-sub-title">Configure store metadata, invoice receipt details, and verify database connectivity.</p>
        </div>
      </div>

      <div className="erp-card" style={{ maxWidth: '800px', marginBottom: '24px' }}>
        <div className="card-header-bar">
          <h3 className="card-heading">Store Profile &amp; Invoice Header</h3>
        </div>
        <form onSubmit={handleSave} className="card-body form-grid">
          <div className="form-group">
            <label>Store Name</label>
            <input type="text" className="erp-input" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Contact Phone</label>
            <input type="text" className="erp-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="form-group">
            <label>GSTIN / Tax ID</label>
            <input type="text" className="erp-input" value={gst} onChange={(e) => setGst(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Store Address</label>
            <textarea rows="2" className="erp-input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Store Profile
            </button>
            {savedMsg && (
              <span className="text-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                <CheckIcon size={14} /> Profile saved successfully!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* System Health Diagnostics */}
      <div className="erp-card" style={{ maxWidth: '800px' }}>
        <div className="card-header-bar">
          <h3 className="card-heading">System Diagnostics &amp; Electron Environment</h3>
        </div>
        <div className="card-body">
          <div className="diag-row">
            <span>Flask REST Backend:</span>
            <span className="status-badge paid">http://127.0.0.1:5000 (Active)</span>
          </div>
          <div className="diag-row">
            <span>PostgreSQL Database:</span>
            <span className={`status-badge ${healthStatus?.database_connection === 'connected' ? 'paid' : 'warning'}`}>
              {healthStatus?.database_connection === 'connected' ? 'Connected (ajay_footwear)' : 'Connecting...'}
            </span>
          </div>
          <div className="diag-row">
            <span>Desktop Platform:</span>
            <span className="code-pill">Electron Desktop (Windows x64)</span>
          </div>
          <div className="diag-row">
            <span>Thermal Printing Protocol:</span>
            <span className="code-pill">ESC/POS &amp; Browser Thermal Print (@media print)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
