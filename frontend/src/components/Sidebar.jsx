import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  DashboardIcon,
  BillIcon,
  CustomerIcon,
  ProductIcon,
  CategoryIcon,
  SalesIcon,
  PurchaseIcon,
  StockIcon,
  BarcodeNavIcon,
  ReportIcon,
  SettingsIcon,
  ShoeLogo,
  LogOutIcon,
} from './Icons'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { path: '/billing', label: 'POS Billing', icon: BillIcon, badge: 'HOT' },
  { path: '/sales', label: 'Sales Invoices', icon: SalesIcon },
  { path: '/products', label: 'Products & Items', icon: ProductIcon },
  { path: '/stock', label: 'Stock & Inventory', icon: StockIcon },
  { path: '/customers', label: 'Parties / Customers', icon: CustomerIcon },
  { path: '/categories', label: 'Categories', icon: CategoryIcon },
  { path: '/purchases', label: 'Purchases Inward', icon: PurchaseIcon },
  { path: '/barcodes', label: 'Barcode Studio', icon: BarcodeNavIcon },
  { path: '/reports', label: 'Reports & Analytics', icon: ReportIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const userInitial = user?.full_name ? user.full_name.trim()[0].toUpperCase() : 'A'
  const userName = user?.full_name || 'Ajay (Owner)'
  const userRole = user?.role || 'Admin'

  return (
    <aside className={`sidebar erp-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-brand-box">
        <ShoeLogo small={collapsed} />
        {!collapsed && (
          <div className="brand-text">
            <span className="brand-name">SWAMIDATT</span>
            <span className="brand-role">Footwear ERP &amp; POS</span>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav" aria-label="Main Navigation">
        <div className="nav-section-label">{!collapsed && 'MENU'}</div>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <div className="link-icon">
                <Icon size={20} />
              </div>
              {!collapsed && <span className="link-text">{item.label}</span>}
              {!collapsed && item.badge && <span className="link-badge">{item.badge}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer Info / Collapse Toggle */}
      <div className="sidebar-footer">
        <button
          type="button"
          className="collapse-toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          >
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
          {!collapsed && <span>Collapse Menu</span>}
        </button>

        {!collapsed ? (
          <div className="user-profile-widget" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div className="user-avatar-circle">{userInitial}</div>
              <div className="user-details">
                <span className="user-name" title={userName}>{userName}</span>
                <span className="user-status-text">{userRole} &bull; v1.0.0 ERP</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444'
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <LogOutIcon size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            title={`Logged in as ${userName} (${userRole}) - Click to Sign Out`}
            aria-label="Sign Out"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <LogOutIcon size={18} />
          </button>
        )}
      </div>
    </aside>
  )
}

