import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeveloperAuth } from '../../context/DeveloperAuthContext'
import './DeveloperLoginPage.css'

export default function DeveloperLoginPage() {
  const navigate = useNavigate()
  const { devLogin, isDevAuthenticated, isDevLoading } = useDeveloperAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [useTotp, setUseTotp] = useState(false)
  const [errors, setErrors] = useState({ username: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (!isDevLoading && isDevAuthenticated) {
      navigate('/developer/dashboard', { replace: true })
    }
  }, [isDevAuthenticated, isDevLoading, navigate])

  const validate = () => {
    const errs = { username: '', password: '' }
    let valid = true

    if (!username.trim()) {
      errs.username = 'Developer username or identifier is required.'
      valid = false
    }

    if (!password) {
      errs.password = 'Master developer password is required.'
      valid = false
    }

    setErrors(errs)
    return valid
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')

    if (isSubmitting) return

    if (!validate()) return

    setIsSubmitting(true)

    try {
      await devLogin(username.trim(), password)
      navigate('/developer/dashboard', { replace: true })
    } catch (err) {
      setAuthError(err.message || 'Authentication rejected. Verify credentials or check rate-limiting status.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="dev-login-container">
      <div className="dev-login-card" role="main">
        {/* Header Branding */}
        <div className="dev-login-header">
          <div className="dev-login-badge">
            <span className="dev-login-badge-dot" />
            SWAMIDATT CONTROL
          </div>
          <h1 className="dev-login-title">Super Admin Portal</h1>
          <p className="dev-login-subtitle">
            Secure developer console &amp; systems administration
          </p>
        </div>

        {/* Security / Lockout Error Alert */}
        {authError && (
          <div className="dev-login-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>{authError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="dev-login-form" noValidate>
          {/* Developer Username */}
          <div className="dev-field-group">
            <label htmlFor="dev-username" className="dev-field-label">
              <span>Developer Identifier</span>
              <span style={{ color: '#64748b', fontSize: '0.74rem' }}>RBAC Protected</span>
            </label>
            <div className="dev-input-wrapper">
              <span className="dev-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                id="dev-username"
                type="text"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                className={`dev-input ${errors.username ? 'has-error' : ''}`}
                placeholder="e.g. dev_admin"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (errors.username) setErrors((prev) => ({ ...prev, username: '' }))
                  if (authError) setAuthError('')
                }}
              />
            </div>
            {errors.username && <span className="dev-field-error">{errors.username}</span>}
          </div>

          {/* Master Password */}
          <div className="dev-field-group">
            <label htmlFor="dev-password" className="dev-field-label">
              <span>Master Password</span>
              <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Argon2 / Scrypt Hash</span>
            </label>
            <div className="dev-input-wrapper">
              <span className="dev-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="dev-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isSubmitting}
                className={`dev-input ${errors.password ? 'has-error' : ''}`}
                placeholder="Enter developer password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
                  if (authError) setAuthError('')
                }}
              />
              <button
                type="button"
                className="dev-input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <span className="dev-field-error">{errors.password}</span>}
          </div>

          {/* Optional TOTP Two-Factor Authenticator */}
          <div className="dev-2fa-section">
            <div
              className="dev-2fa-toggle-row"
              onClick={() => setUseTotp(!useTotp)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>Two-Factor Authentication (TOTP)</span>
              </div>
              <span style={{ fontSize: '0.74rem', color: useTotp ? '#3b82f6' : '#64748b', fontWeight: 600 }}>
                {useTotp ? 'Active' : 'Optional'}
              </span>
            </div>

            {useTotp && (
              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit authenticator code"
                  className="dev-input"
                  style={{ letterSpacing: '0.25em', textAlign: 'center', fontSize: '1.05rem', fontWeight: 700 }}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="dev-submit-btn"
            disabled={isSubmitting}
            id="dev-login-submit"
          >
            {isSubmitting ? (
              <>
                <span className="dev-spinner" />
                <span>Verifying Authorization...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                <span>Authenticate &amp; Enter Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Security Policy Notice */}
        <div className="dev-security-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>Rate limited. 5 failed attempts trigger 15-minute IP lockout.</span>
        </div>
      </div>

      <div className="dev-outer-footer">
        SWAMIDATT CONTROL &bull; RESTRICTED DEVELOPER ACCESS ONLY
      </div>
    </div>
  )
}
