import { Activity, FlaskConical, Gauge, KeyRound, ListTree, LogOut, Menu, RefreshCcw, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AuthDrawer } from '../components/AuthDrawer'
import { Button, StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { useRefreshControls } from './RefreshContext'

const navItems = [
  { to: '/', label: 'Overview', icon: Gauge },
  { to: '/rules', label: 'Rules', icon: ListTree },
  { to: '/sandbox', label: 'Sandbox', icon: FlaskConical },
  { to: '/algorithms', label: 'Algorithms', icon: Activity },
]

function pageTitle(pathname: string): string {
  if (pathname.startsWith('/rules/')) return 'Client detail'
  if (pathname === '/rules') return 'Rules'
  if (pathname === '/sandbox') return 'Sandbox'
  if (pathname === '/algorithms') return 'Algorithms'
  if (pathname === '/styleguide') return 'Styleguide'
  if (pathname === '/login') return 'Login'
  return 'Overview'
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const { pathname } = useLocation()
  const { isAuthenticated, signOut } = useAuth()
  const { refreshInterval, setRefreshInterval, manualRefresh } = useRefreshControls()

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-ink-700 bg-ink-900 transition-all md:flex md:flex-col ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-700 px-4">
          <div className="font-semibold tracking-wide">{collapsed ? 'A' : 'Aegis'}</div>
          <button className="rounded p-1 text-ink-300 hover:text-ink-100" aria-label="Toggle navigation rail" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    isActive ? 'bg-accent-500 text-ink-950' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
                  }`
                }
              >
                <Icon size={18} aria-hidden="true" />
                {!collapsed ? <span>{item.label}</span> : null}
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-ink-700 p-3 text-xs text-ink-300">
          <div className="mb-2 font-medium text-ink-100">{collapsed ? 'Sys' : 'System status'}</div>
          <div className="space-y-2">
            <StatusBadge label={collapsed ? 'Redis' : 'Redis via health'} tone="outline" />
            {!collapsed ? <StatusBadge label="Fail mode: Not exposed" tone="dashed" /> : null}
          </div>
        </div>
      </aside>

      <div className={collapsed ? 'md:pl-16' : 'md:pl-60'}>
        <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Aegis Control Plane</p>
              <h1 className="text-xl font-semibold">{pageTitle(pathname)}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-ink-300">
                Refresh
                <select
                  className="rounded-md border border-ink-700 bg-ink-800 px-2 py-2 text-ink-100"
                  value={refreshInterval || 'off'}
                  onChange={(event) => {
                    const value = event.target.value
                    setRefreshInterval(value === 'off' ? false : value === '10000' ? 10000 : 5000)
                  }}
                >
                  <option value="5000">5s</option>
                  <option value="10000">10s</option>
                  <option value="off">Off</option>
                </select>
              </label>
              <Button variant="secondary" onClick={manualRefresh}>
                <RefreshCcw size={16} aria-hidden="true" />
                <span className="ml-2">Refresh</span>
              </Button>
              {isAuthenticated ? (
                <Button variant="secondary" onClick={signOut}>
                  <LogOut size={16} aria-hidden="true" />
                  <span className="ml-2">Sign out</span>
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setAuthOpen(true)}>
                  <KeyRound size={16} aria-hidden="true" />
                  <span className="ml-2">Sign in</span>
                </Button>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
          <Outlet context={{ openAuth: () => setAuthOpen(true) }} />
        </main>
      </div>
      <AuthDrawer open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
