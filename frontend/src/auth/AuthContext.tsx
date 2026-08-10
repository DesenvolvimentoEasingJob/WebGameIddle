import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearToken,
  fetchMe,
  getToken,
  login as apiLogin,
  register as apiRegister,
  setToken,
} from '../api/auth'
import type { MeResponse } from '../types/api'
import { ApiError } from '../api/client'

type AuthState = {
  user: MeResponse | null
  loading: boolean
  login: (usernameOrEmail: string, password: string) => Promise<MeResponse>
  register: (username: string, email: string, password: string) => Promise<MeResponse>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const me = await fetchMe()
      setUser(me)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken()
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const res = await apiLogin(usernameOrEmail, password)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await apiRegister(username, email, password)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
