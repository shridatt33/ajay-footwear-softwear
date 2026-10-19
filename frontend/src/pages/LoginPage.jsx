import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  UserIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
} from '../components/Icons'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({ username: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If already authenticated, redirect straight to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const validateForm = () => {
    const newErrors = { username: '', password: '' }
    let isValid = true

    if (!username.trim()) {
      newErrors.username = 'Please enter your username.'
      isValid = false
    }

    if (!password) {
      newErrors.password = 'Please enter your password.'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')

    if (isSubmitting) return

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      await login(username.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setAuthError(err.message || 'Invalid username or password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="login-page-container">
        <div className="login-page-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              margin: '0 auto 16px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#285CF5',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b', fontWeight: 500 }}>
            Verifying secure session...
          </p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page-container">
      <div className="login-page-card" role="main">
        {/* Brand Header */}
        <div className="login-brand-section">
          <div className="login-brand-icon-wrapper" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 17.5 7 14l3.5 3.5 5-5L20.5 17.5" />
              <path d="M2 19h20" />
              <path d="m14 12.5 3-3 4 4" />
            </svg>
          </div>
          <h1 className="login-brand-name">SWAMIDATT FOOTWEAR</h1>
          <span className="login-brand-tagline">Retail Management &amp; POS</span>
        </div>

        {/* Welcome Section */}
        <div className="login-header-group">
          <h2 className="login-heading">Welcome Back!</h2>
          <p className="login-subtitle">Sign in to manage your shop</p>
        </div>

        {/* Backend Error Alert */}
        {authError && (
          <div className="login-error-banner" role="alert">
            <AlertTriangleIcon size={18} />
            <span>{authError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="login-form" noValidate>
          {/* Username Field */}
          <div className="login-field-group">
            <label htmlFor="login-username" className="login-label">
              <span>Username</span>
            </label>
            <div className="login-input-wrapper">
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                className={`login-input ${errors.username ? 'has-error' : ''}`}
                placeholder="Enter operator username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (errors.username) setErrors((prev) => ({ ...prev, username: '' }))
                  if (authError) setAuthError('')
                }}
              />
              <span className="login-input-icon" aria-hidden="true">
                <UserIcon size={18} />
              </span>
            </div>
            {errors.username && (
              <span className="login-field-error-msg" role="alert">
                {errors.username}
              </span>
            )}
          </div>

          {/* Password Field */}
          <div className="login-field-group">
            <label htmlFor="login-password" className="login-label">
              <span>Password</span>
            </label>
            <div className="login-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isSubmitting}
                className={`login-input ${errors.password ? 'has-error' : ''}`}
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
                  if (authError) setAuthError('')
                }}
              />
              <span className="login-input-icon" aria-hidden="true">
                <LockIcon size={18} />
              </span>
              <button
                type="button"
                className="login-input-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
            {errors.password && (
              <span className="login-field-error-msg" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting}
            id="login-submit-button"
          >
            {isSubmitting ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Login to Dashboard</span>
            )}
          </button>
        </form>

        {/* Small Footer */}
        <div className="login-card-footer">
          <ShieldCheckIcon size={16} />
          <span>Secure Shop Management System</span>
        </div>
      </div>

      <div className="login-outer-meta">
        SWAMIDATT FOOTWEAR ERP &bull; Desktop Terminal v1.0.0
      </div>
    </div>
  )
}
