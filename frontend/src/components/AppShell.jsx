import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopHeader from './TopHeader'
import GlobalSearchModal from './GlobalSearchModal'

export default function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('erp_sidebar_collapsed') === 'true'
  })
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()

  const handleToggleCollapse = (val) => {
    setSidebarCollapsed(val)
    localStorage.setItem('erp_sidebar_collapsed', val ? 'true' : 'false')
  }

  // Global Keyboard Shortcuts (Ctrl+F, Ctrl+B, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F or Cmd+F -> Global Search
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setSearchOpen(true)
      }
      // Ctrl+B or Cmd+B -> New Bill / POS
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        navigate('/billing')
      }
      // Esc -> Close search modal
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <div className="app-shell erp-app-shell">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={handleToggleCollapse} />

      <div className={`app-main erp-main-container ${sidebarCollapsed ? 'sidebar-collapsed sidebar-is-collapsed' : ''}`}>
        <TopHeader onOpenSearch={() => setSearchOpen(true)} />

        <main className="page-content erp-page-viewport" id="main-page-content">
          <Outlet />
        </main>
      </div>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
