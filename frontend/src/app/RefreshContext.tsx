import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'

type RefreshInterval = 5000 | 10000 | false

interface RefreshContextValue {
  refreshInterval: RefreshInterval
  setRefreshInterval: (value: RefreshInterval) => void
  refreshNonce: number
  manualRefresh: () => void
}

const RefreshContext = createContext<RefreshContextValue | null>(null)

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(5000)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const value = useMemo(
    () => ({
      refreshInterval,
      setRefreshInterval,
      refreshNonce,
      manualRefresh: () => setRefreshNonce((current) => current + 1),
    }),
    [refreshInterval, refreshNonce],
  )
  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
}

export function useRefreshControls() {
  const value = useContext(RefreshContext)
  if (!value) {
    throw new Error('useRefreshControls must be used inside RefreshProvider')
  }
  return value
}
