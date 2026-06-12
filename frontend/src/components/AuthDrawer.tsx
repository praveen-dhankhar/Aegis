import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, inputClass } from './ui'
import { useAuth } from '../features/auth/AuthContext'

interface AuthDrawerProps {
  open: boolean
  onClose: () => void
}

export function AuthDrawer({ open, onClose }: AuthDrawerProps) {
  const { signIn } = useAuth()
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return null
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(key)
      setKey('')
      onClose()
    } catch {
      setError('The admin key was rejected. Write controls remain locked.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/70" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="flex-1 cursor-default" aria-label="Close sign in panel" onClick={onClose} />
      <form onSubmit={onSubmit} className="h-full w-full max-w-md border-l border-ink-700 bg-ink-900 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-title" className="text-xl font-semibold">
              Admin sign in
            </h2>
            <p className="mt-2 text-sm text-ink-300">The key is kept in React memory only and is sent as `X-Admin-Key` for writes.</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <label className="mt-8 block">
          <span className="mb-1 block text-sm font-medium">Admin key</span>
          <input ref={inputRef} className={inputClass} type="password" value={key} onChange={(event) => setKey(event.target.value)} />
        </label>
        {error ? <p className="mt-3 text-sm text-ink-100" role="alert">{error}</p> : null}
        <Button className="mt-6 w-full" variant="primary" type="submit" disabled={submitting || key.trim().length === 0}>
          {submitting ? 'Validating...' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
