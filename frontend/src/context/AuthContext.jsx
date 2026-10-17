import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config'

const AuthContext = createContext(null)
const TOKEN_STORAGE_KEY = 'swamidatt_erp_token'
const USER_STORAGE_KEY = 'swamidatt_erp_user'

// Clean up any legacy persistent auth tokens from localStorage so cold start requires login
try {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
} catch (_) {}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem(USER_STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(() => Boolean(sessionStorage.getItem(TOKEN_STORAGE_KEY)))

  // Verify stored session token with the backend on app start / reload
  const verifySession = useCallback(async (existingToken) => {
    if (!existingToken) {
      setUser(null)
      setIsAuthenticated(false)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${existingToken}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.authenticated && data.user) {
          setUser(data.user)
          setIsAuthenticated(true)
          sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
        } else {
          // Token invalid or expired on backend
          sessionStorage.removeItem(TOKEN_STORAGE_KEY)
          sessionStorage.removeItem(USER_STORAGE_KEY)
          setUser(null)
          setToken(null)
          setIsAuthenticated(false)
        }
      } else {
        // Backend returned 401 or other rejection
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
        sessionStorage.removeItem(USER_STORAGE_KEY)
        setUser(null)
        setToken(null)
        setIsAuthenticated(false)
      }
    } catch (err) {
      // If network fails (e.g. backend still starting up), keep state safe
      console.warn('Backend session verification connection failed:', err)
      sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      sessionStorage.removeItem(USER_STORAGE_KEY)
      setUser(null)
      setToken(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    verifySession(token)
  }, [verifySession, token])

  const login = async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Authentication failed. Please verify your credentials.')
    }

    sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(USER_STORAGE_KEY)
    } catch (_) {}
    setToken(data.token)
    setUser(data.user)
    setIsAuthenticated(true)
    return data
  }

  const logout = async () => {
    const activeToken = token || sessionStorage.getItem(TOKEN_STORAGE_KEY)
    if (activeToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
        })
      } catch (err) {
        console.warn('Logout network notification failed:', err)
      }
    }

    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(USER_STORAGE_KEY)
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(USER_STORAGE_KEY)
    } catch (_) {}
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
