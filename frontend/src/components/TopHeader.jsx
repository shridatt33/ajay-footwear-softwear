import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SearchIcon, BillIcon, PurchaseIcon, LogOutIcon } from './Icons'

export default function TopHeader({ onOpenSearch }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [timeStr, setTimeStr] = useState('')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      setDateStr(now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }))
      setTimeStr(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
    }
    updateDateTime()
    const timer = setInterval(updateDateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const initialLetter = user?.full_name ? user.full_name.trim()[0].toUpperCase() : 'A'
  const displayName = user?.full_name || 'Swamidatt Footwear'

  return (
    <header className="top-header erp-topbar">
      {/* Global Search trigger */}
      <div
        className="topbar-search-trigger"
        onClick={onOpenSearch}
        role="button"
        tabIndex={0}
        aria-label="Search records"
      >
        <SearchIcon size={16} className="search-icon" />
        <span className="search-placeholder">Search products, barcodes, bills, customers...</span>
        <kbd className="search-kbd">Ctrl + F</kbd>
      </div>

      {/* Right controls */}
      <div className="topbar-actions">
        {/* Quick action buttons */}
        <button
          type="button"
          className="btn btn-primary btn-sm topbar-btn"
          onClick={() => navigate('/billing')}
          title="New Bill (Ctrl + B)"
        >
          <BillIcon size={15} />
          <span>+ Sale</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm topbar-btn"
          onClick={() => navigate('/purchases')}
          title="Add Purchase Inward"
        >
          <PurchaseIcon size={15} />
          <span>+ Purchase</span>
        </button>

        {/* Live Date / Time Badge */}
        <div className="live-clock-badge">
          <span className="clock-date">{dateStr}</span>
          <span className="clock-divider">|</span>
          <span className="clock-time">{timeStr}</span>
        </div>

        {/* User profile dropdown pill */}
        <div className="header-user-pill" title={`Logged in as ${displayName} (${user?.username || 'user'})`}>
          <div className="pill-avatar">{initialLetter}</div>
          <span className="pill-name">{displayName}</span>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-secondary btn-sm topbar-btn"
          title="Sign out of ERP system"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#dc2626',
            borderColor: '#fecaca',
            backgroundColor: '#fff',
            fontWeight: 500
          }}
        >
          <LogOutIcon size={15} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  )
}

