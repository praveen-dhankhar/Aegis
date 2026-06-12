import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, inputClass, Panel } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useAuth } from './AuthContext'

export function LoginPage() {
  useDocumentTitle('Login')
  const { signIn, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(key)
      navigate('/rules')
    } catch {
      setError('Invalid admin key.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Panel className="mx-auto max-w-lg">
      <h2 className="text-2xl font-semibold">Admin login</h2>
      <p className="mt-2 text-sm text-ink-300">The key is validated with `/admin/auth/validate` and kept in memory only.</p>
      {isAuthenticated ? <p className="mt-4 rounded-md bg-ink-800 p-3 text-sm">An admin key is active for this browser session.</p> : null}
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">X-Admin-Key</span>
          <input className={inputClass} type="password" value={key} onChange={(event) => setKey(event.target.value)} />
        </label>
        {error ? <p role="alert" className="text-sm text-ink-100">{error}</p> : null}
        <Button type="submit" variant="primary" disabled={submitting || key.trim().length === 0}>
          {submitting ? 'Validating...' : 'Sign in'}
        </Button>
      </form>
    </Panel>
  )
}
