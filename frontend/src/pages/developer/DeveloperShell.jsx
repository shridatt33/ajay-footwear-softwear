import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useDeveloperAuth } from '../../context/DeveloperAuthContext'
import './DeveloperShell.css'

export default function DeveloperShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { devUser, devLogout } = useDeveloperAuth()

  const handleLogout = async () => {
    if (window.confirm('Terminate developer session and exit dashboard?')) {
      await devLogout()
      navigate('/developer-access', { replace: true })
    }
  }

  // Determine current active section title for topbar
  const getSectionTitle = () => {
    const path = location.pathname
    const search = location.search

    if (path.includes('/developer/dashboard')) return 'System Overview'
    if (path.includes('/developer/users')) {
      if (search.includes('tab=roles')) return 'User & Role Management'
      return 'Shop Accounts'
    }
    if (path.includes('/developer/system')) {
      if (search.includes('tab=database')) return 'Database Status'
      if (search.includes('tab=config')) return 'Application Configuration'
      return 'System Health & Metrics'
    }
    if (path.includes('/developer/security')) {
      if (search.includes('tab=logins')) return 'Login Activity Stream'
      return 'Security Audit Logs'
    }
    if (path.includes('/developer/settings')) {
      if (search.includes('tab=backups')) return 'Backup & Disaster Recovery'
      return 'Developer Console Settings'
    }
    return 'Developer Super Admin'
  }

  // Active matcher for sub-tabs
  const isNavActive = (targetPath, tabParam) => {
    if (!location.pathname.startsWith(targetPath)) return false
    if (!tabParam) {
      return !location.search || location.search.includes('tab=overview') || (!location.search.includes('tab=') && targetPath === location.pathname)
    }
    return location.search.includes(`tab=${tabParam}`)
  }

  return (
    <div className="dev-layout">
      {/* Dark Navy Sidebar */}
      <aside className="dev-sidebar">
        <div className="dev-sidebar-brand">
          <div className="dev-brand-badge">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
            SWAMIDATT CONTROL
          </div>
          <h2 className="dev-brand-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            SUPER ADMIN
          </h2>
          <div className="dev-brand-sub">Platform Engineering &amp; Operations</div>
        </div>

        <nav className="dev-sidebar-nav">
          <div className="dev-nav-section-title">Core Operations</div>
          
          {/* 1. Overview */}
          <NavLink
            to="/developer/dashboard"
            className={() => `dev-nav-item ${location.pathname === '/developer/dashboard' ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span>Overview</span>
          </NavLink>

          <div className="dev-nav-section-title">Identity &amp; Accounts</div>

          {/* 2. Shop Accounts */}
          <NavLink
            to="/developer/users?tab=accounts"
            className={() => `dev-nav-item ${isNavActive('/developer/users', 'accounts') || (location.pathname === '/developer/users' && !location.search.includes('tab=roles')) ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Shop Accounts</span>
          </NavLink>

          {/* 3. User & Role Management */}
          <NavLink
            to="/developer/users?tab=roles"
            className={() => `dev-nav-item ${isNavActive('/developer/users', 'roles') ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span>User &amp; Role Management</span>
          </NavLink>

          <div className="dev-nav-section-title">System &amp; Diagnostics</div>

          {/* 4. System Health */}
          <NavLink
            to="/developer/system?tab=health"
            className={() => `dev-nav-item ${isNavActive('/developer/system', 'health') || (location.pathname === '/developer/system' && !location.search.includes('tab=')) ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <activity />
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>System Health</span>
          </NavLink>

          {/* 5. Database Status */}
          <NavLink
            to="/developer/system?tab=database"
            className={() => `dev-nav-item ${isNavActive('/developer/system', 'database') ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            <span>Database Status</span>
          </NavLink>

          {/* 6. Application Configuration */}
          <NavLink
            to="/developer/system?tab=config"
            className={() => `dev-nav-item ${isNavActive('/developer/system', 'config') ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Application Configuration</span>
          </NavLink>

          <div className="dev-nav-section-title">Security &amp; Audit</div>

          {/* 7. Login Activity */}
          <NavLink
            to="/developer/security?tab=logins"
            className={() => `dev-nav-item ${isNavActive('/developer/security', 'logins') ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            <span>Login Activity</span>
          </NavLink>

          {/* 8. Security Audit Logs */}
          <NavLink
            to="/developer/security?tab=audit"
            className={() => `dev-nav-item ${isNavActive('/developer/security', 'audit') || (location.pathname === '/developer/security' && !location.search.includes('tab=')) ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span>Security Audit Logs</span>
          </NavLink>

          <div className="dev-nav-section-title">Storage &amp; Settings</div>

          {/* 9. Backup & Recovery */}
          <NavLink
            to="/developer/settings?tab=backups"
            className={() => `dev-nav-item ${isNavActive('/developer/settings', 'backups') ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Backup &amp; Recovery</span>
          </NavLink>

          {/* 10. Developer Settings */}
          <NavLink
            to="/developer/settings?tab=settings"
            className={() => `dev-nav-item ${isNavActive('/developer/settings', 'settings') || (location.pathname === '/developer/settings' && !location.search.includes('tab=')) ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Developer Settings</span>
          </NavLink>

          <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
            {/* 11. Logout */}
            <button
              type="button"
              className="dev-nav-item"
              onClick={handleLogout}
              style={{ color: '#f87171' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Logout Session</span>
            </button>
          </div>
        </nav>

        {/* User Identity Chip */}
        <div className="dev-sidebar-footer">
          <div className="dev-user-chip">
            <div className="dev-user-avatar">
              {devUser?.username?.substring(0, 2).toUpperCase() || 'SA'}
            </div>
            <div className="dev-user-info">
              <div className="dev-user-name">{devUser?.full_name || devUser?.username || 'Super Admin'}</div>
              <div className="dev-user-role">SUPER ADMIN</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dev-main-wrap">
        {/* Topbar */}
        <header className="dev-topbar">
          <div className="dev-topbar-left">
            <span className="dev-breadcrumb-prefix">SWAMIDATT CONTROL</span>
            <span className="dev-breadcrumb-divider">/</span>
            <span className="dev-breadcrumb-current">{getSectionTitle()}</span>
          </div>

          <div className="dev-topbar-right">
            <div className="dev-status-pill">
              <span className="dev-status-dot" />
              <span>SYSTEM NORMAL</span>
            </div>

            <button
              type="button"
              className="dev-refresh-btn"
              onClick={() => window.location.reload()}
              title="Reload live telemetry"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="dev-logout-btn"
              onClick={handleLogout}
              title="Terminate developer session"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Exit</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="dev-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
