import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { validateAdminKey } from '../../api/auth'
import { ApiError } from '../../api/types'

interface AuthContextValue {
  adminKey: string | null
  isAuthenticated: boolean
  signIn: (key: string) => Promise<void>
  signOut: () => void
  clearOnUnauthorized: (error: unknown) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminKey, setAdminKey] = useState<string | null>(null)

  const signIn = useCallback(async (key: string) => {
    const trimmed = key.trim()
    await validateAdminKey(trimmed)
    setAdminKey(trimmed)
  }, [])

  const signOut = useCallback(() => setAdminKey(null), [])

  const clearOnUnauthorized = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      setAdminKey(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      adminKey,
      isAuthenticated: adminKey != null,
      signIn,
      signOut,
      clearOnUnauthorized,
    }),
    [adminKey, signIn, signOut, clearOnUnauthorized],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
