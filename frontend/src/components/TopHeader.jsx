import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SearchIcon, BillIcon, LogOutIcon, CalendarIcon, ClockIcon, ChevronDownIcon } from './Icons'

export default function TopHeader({ onOpenSearch }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [timeStr, setTimeStr] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      // Date in Asia/Kolkata (e.g. 23 Oct 2026)
      const formattedDate = new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(now)

      // Time in Asia/Kolkata (e.g. 10:29 PM) - 12-hour, uppercase AM/PM, no seconds
      const formattedTime = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(now)

      setDateStr(formattedDate)
      setTimeStr(formattedTime)
    }

    updateDateTime()
    const timer = setInterval(updateDateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dropdownOpen])

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const username = user?.username || 'swami'
  const initialLetter = (user?.username?.[0] || user?.full_name?.[0] || 'S').toUpperCase()
  const roleName = user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()) : 'Admin'

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
        {/* Quick action button: Sale only */}
        <button
          type="button"
          className="btn btn-primary btn-sm topbar-btn"
          onClick={() => navigate('/billing')}
          title="New Bill (Ctrl + B)"
        >
          <BillIcon size={15} />
          <span>+ Sale</span>
        </button>

        {/* Live Date / Time Badge */}
        <div className="topbar-datetime" title="Current Date & Time (Asia/Kolkata)">
          <div className="datetime-segment datetime-date">
            <CalendarIcon size={13} className="datetime-icon" />
            <span>{dateStr}</span>
          </div>
          <span className="datetime-divider" aria-hidden="true">|</span>
          <div className="datetime-segment datetime-time">
            <ClockIcon size={13} className="datetime-icon" />
            <span>{timeStr}</span>
          </div>
        </div>

        {/* User profile dropdown pill */}
        <div className="user-profile-menu-container" ref={dropdownRef}>
          <button
            type="button"
            className={`header-user-pill ${dropdownOpen ? 'active' : ''}`}
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            title={`Account: ${username} (${roleName}) - Click for options`}
          >
            <div className="pill-avatar">{initialLetter}</div>
            <span className="pill-name">{username}</span>
            <ChevronDownIcon size={13} className={`pill-chevron ${dropdownOpen ? 'open' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="user-profile-dropdown" role="menu">
              <div className="dropdown-user-header">
                <div className="dropdown-avatar">{initialLetter}</div>
                <div className="dropdown-user-details">
                  <div className="dropdown-username">{username}</div>
                  <span className="dropdown-role-badge">{roleName}</span>
                </div>
              </div>

              <div className="dropdown-divider" />

              <div className="dropdown-menu-list">
                <button
                  type="button"
                  className="dropdown-item dropdown-logout-btn"
                  onClick={handleLogout}
                  role="menuitem"
                >
                  <LogOutIcon size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}


