import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config'

const DeveloperAuthContext = createContext(null)

const DEV_TOKEN_KEY = 'swamidatt_dev_token'
const DEV_USER_KEY = 'swamidatt_dev_user'

export function DeveloperAuthProvider({ children }) {
  const [devToken, setDevToken] = useState(() => sessionStorage.getItem(DEV_TOKEN_KEY))
  const [devUser, setDevUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DEV_USER_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(false)
  const [isDevLoading, setIsDevLoading] = useState(() => Boolean(sessionStorage.getItem(DEV_TOKEN_KEY)))

  const verifyDevSession = useCallback(async (token) => {
    if (!token) {
      setDevUser(null)
      setIsDevAuthenticated(false)
      setIsDevLoading(false)
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/developer/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.authenticated && data.user && data.user.role === 'developer_super_admin') {
          setDevUser(data.user)
          setIsDevAuthenticated(true)
          sessionStorage.setItem(DEV_USER_KEY, JSON.stringify(data.user))
        } else {
          sessionStorage.removeItem(DEV_TOKEN_KEY)
          sessionStorage.removeItem(DEV_USER_KEY)
          setDevToken(null)
          setDevUser(null)
          setIsDevAuthenticated(false)
        }
      } else {
        sessionStorage.removeItem(DEV_TOKEN_KEY)
        sessionStorage.removeItem(DEV_USER_KEY)
        setDevToken(null)
        setDevUser(null)
        setIsDevAuthenticated(false)
      }
    } catch (err) {
      console.warn('Developer session verification failed:', err)
      sessionStorage.removeItem(DEV_TOKEN_KEY)
      sessionStorage.removeItem(DEV_USER_KEY)
      setDevToken(null)
      setDevUser(null)
      setIsDevAuthenticated(false)
    } finally {
      setIsDevLoading(false)
    }
  }, [])

  useEffect(() => {
    verifyDevSession(devToken)
  }, [verifyDevSession, devToken])

  const devLogin = async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/developer/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Developer authentication failed.')
    }

    if (data.user?.role !== 'developer_super_admin') {
      throw new Error('Access denied: Account does not have developer privileges.')
    }

    sessionStorage.setItem(DEV_TOKEN_KEY, data.token)
    sessionStorage.setItem(DEV_USER_KEY, JSON.stringify(data.user))
    setDevToken(data.token)
    setDevUser(data.user)
    setIsDevAuthenticated(true)
    return data
  }

  const devLogout = async () => {
    const activeToken = devToken || sessionStorage.getItem(DEV_TOKEN_KEY)
    if (activeToken) {
      try {
        await fetch(`${API_BASE_URL}/developer/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
        })
      } catch (err) {
        console.warn('Developer logout notification error:', err)
      }
    }

    sessionStorage.removeItem(DEV_TOKEN_KEY)
    sessionStorage.removeItem(DEV_USER_KEY)
    setDevToken(null)
    setDevUser(null)
    setIsDevAuthenticated(false)
  }

  const value = {
    devUser,
    devToken,
    isDevAuthenticated,
    isDevLoading,
    devLogin,
    devLogout,
    refreshSession: () => verifyDevSession(devToken),
  }

  return (
    <DeveloperAuthContext.Provider value={value}>
      {children}
    </DeveloperAuthContext.Provider>
  )
}

export function useDeveloperAuth() {
  const context = useContext(DeveloperAuthContext)
  if (!context) {
    throw new Error('useDeveloperAuth must be used within a DeveloperAuthProvider')
  }
  return context
}
