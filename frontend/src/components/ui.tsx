import { clsx } from 'clsx'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }
>(function Button({ className, variant = 'secondary', ...props }, ref) {
  const variants = {
    primary: 'bg-accent-500 text-ink-950 hover:bg-accent-300',
    secondary: 'border border-ink-700 bg-ink-800 text-ink-100 hover:border-ink-500',
    ghost: 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
    danger: 'border border-dashed border-ink-500 bg-ink-900 text-ink-100 hover:border-ink-100',
  }
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
})

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('rounded-lg border border-ink-700 bg-ink-900 p-5', className)}>{children}</section>
}

export function StatusBadge({ label, tone = 'solid' }: { label: string; tone?: 'solid' | 'outline' | 'dashed' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium',
        tone === 'solid' && 'bg-ink-800 text-ink-100',
        tone === 'outline' && 'border border-ink-700 text-ink-300',
        tone === 'dashed' && 'border border-dashed border-ink-500 text-ink-300',
      )}
    >
      <span className={clsx('h-2 w-2 rounded-full border border-current', tone === 'solid' && 'bg-current')} aria-hidden="true" />
      {label}
    </span>
  )
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-4 animate-pulse rounded bg-ink-800" />
      ))}
    </div>
  )
}

export function ErrorState({ title = 'Request failed', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-500 bg-ink-900 p-4">
      <h2 className="text-base font-semibold text-ink-100">{title}</h2>
      <p className="mt-1 text-sm text-ink-300">{message}</p>
      {onRetry ? (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-700 p-8 text-center">
      <h2 className="text-base font-semibold text-ink-100">{title}</h2>
      <p className="mt-2 text-sm text-ink-300">{message}</p>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-100">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-accent-500'
