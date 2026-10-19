import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DeveloperAuthProvider } from './context/DeveloperAuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DeveloperProtectedRoute from './components/DeveloperProtectedRoute'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import BillingPage from './pages/BillingPage'
import SalesPage from './pages/SalesPage'
import CustomersPage from './pages/CustomersPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import StockPage from './pages/StockPage'
import PurchasesPage from './pages/PurchasesPage'
import BarcodesPage from './pages/BarcodesPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import DeveloperLoginPage from './pages/developer/DeveloperLoginPage'
import DeveloperShell from './pages/developer/DeveloperShell'
import DeveloperOverviewPage from './pages/developer/DeveloperOverviewPage'
import DeveloperUsersPage from './pages/developer/DeveloperUsersPage'
import DeveloperSystemPage from './pages/developer/DeveloperSystemPage'
import DeveloperSecurityPage from './pages/developer/DeveloperSecurityPage'
import DeveloperSettingsPage from './pages/developer/DeveloperSettingsPage'
import './App.css'

export default function App() {
  return (
    <DeveloperAuthProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Public Shop Authentication Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Hidden Dedicated Developer Authentication Route */}
            <Route path="/developer-access" element={<DeveloperLoginPage />} />

            {/* Protected Developer Super Admin Routes */}
            <Route element={<DeveloperProtectedRoute />}>
              <Route element={<DeveloperShell />}>
                <Route path="/developer/dashboard" element={<DeveloperOverviewPage />} />
                <Route path="/developer/users" element={<DeveloperUsersPage />} />
                <Route path="/developer/system" element={<DeveloperSystemPage />} />
                <Route path="/developer/security" element={<DeveloperSecurityPage />} />
                <Route path="/developer/settings" element={<DeveloperSettingsPage />} />
                <Route path="/developer" element={<Navigate to="/developer/dashboard" replace />} />
              </Route>
            </Route>

            {/* Protected ERP Application Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/scanner" element={<Navigate to="/billing" replace />} />
                <Route path="/barcode-scanner" element={<Navigate to="/billing" replace />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:customerId" element={<CustomersPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/purchases" element={<PurchasesPage />} />
                <Route path="/barcodes" element={<BarcodesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </DeveloperAuthProvider>
  )
}


