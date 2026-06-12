import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../../api/auth', () => ({
  validateAdminKey: vi.fn(() => Promise.resolve()),
}))

function Probe() {
  const { isAuthenticated, signIn } = useAuth()
  return (
    <div>
      <span>{isAuthenticated ? 'signed-in' : 'signed-out'}</span>
      <button onClick={() => void signIn('secret')}>sign in</button>
    </div>
  )
}

describe('AuthContext', () => {
  it('keeps auth in React memory', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByText('signed-out')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'sign in' }))
    expect(await screen.findByText('signed-in')).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
