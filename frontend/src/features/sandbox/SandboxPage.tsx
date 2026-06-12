import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { fireSandboxRequest } from '../../api/sandbox'
import { listRateLimits } from '../../api/rateLimits'
import { Button, EmptyState, ErrorState, Field, inputClass, Panel, StatusBadge } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { resetLabel } from '../../lib/rateLimitHeaders'
import { queryKeys } from '../../lib/queryKeys'

type SandboxState = 'Idle' | 'Sending' | 'Completed' | 'Cancelled' | 'Failed'

interface LogRow {
  sequence: number
  timestamp: string
  status: number | 'ERR'
  limit: number | null
  remaining: number | null
  reset: string
  retryAfter: number | null
  durationMs: number | null
  error?: string
}

const burstSizes = [1, 5, 20, 50]

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

export function SandboxPage() {
  useDocumentTitle('Sandbox')
  const rules = useQuery({ queryKey: queryKeys.rules, queryFn: ({ signal }) => listRateLimits(signal) })
  const [manualClientId, setManualClientId] = useState('demo-client')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [state, setState] = useState<SandboxState>('Idle')
  const [rows, setRows] = useState<LogRow[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const clientId = selectedClientId || manualClientId
  const selectedRule = rules.data?.find((rule) => rule.client_id === clientId)
  const summary = rows.reduce(
    (acc, row) => {
      acc.sent += 1
      if (row.status === 429) acc.rejected += 1
      else if (row.status === 200) acc.allowed += 1
      else acc.failed += 1
      if (row.durationMs != null) acc.totalDuration += row.durationMs
      if (row.status === 429 && acc.firstRejected == null) acc.firstRejected = row.sequence
      if (row.retryAfter != null) acc.retryAfter = row.retryAfter
      return acc
    },
    { sent: 0, allowed: 0, rejected: 0, failed: 0, totalDuration: 0, firstRejected: null as number | null, retryAfter: null as number | null },
  )

  async function fireBurst(size: number) {
    if (!clientId.trim()) return
    const controller = new AbortController()
    abortRef.current = controller
    setState('Sending')
    const startSequence = rows.length + 1
    try {
      for (let index = 0; index < size; index += 1) {
        const sequence = startSequence + index
        try {
          const response = await fireSandboxRequest(clientId.trim(), controller.signal)
          setRows((current) => [
            ...current.slice(-199),
            {
              sequence,
              timestamp: new Date().toLocaleTimeString(),
              status: response.status,
              limit: response.headers.limit,
              remaining: response.headers.remaining,
              reset: resetLabel(response.headers.resetEpochMs),
              retryAfter: response.headers.retryAfterSeconds,
              durationMs: response.durationMs,
            },
          ])
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw error
          setRows((current) => [
            ...current.slice(-199),
            {
              sequence,
              timestamp: new Date().toLocaleTimeString(),
              status: 'ERR',
              limit: null,
              remaining: null,
              reset: 'Unavailable',
              retryAfter: null,
              durationMs: null,
              error: error instanceof Error ? error.message : 'Request failed',
            },
          ])
        }
        await sleep(80 + Math.round(Math.random() * 40), controller.signal)
      }
      setState('Completed')
    } catch (error) {
      setState(error instanceof DOMException && error.name === 'AbortError' ? 'Cancelled' : 'Failed')
    } finally {
      abortRef.current = null
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Panel>
        <h2 className="text-xl font-semibold">Algorithm sandbox</h2>
        <p className="mt-2 text-sm text-ink-300">Requests are sent sequentially to `/api/test` with `X-API-Key` and 80-120ms jitter.</p>
        <div className="mt-6 space-y-4">
          {rules.isError ? <ErrorState message="Rules could not be loaded. Manual client IDs still work." /> : null}
          <Field label="Known client">
            <select className={inputClass} value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              <option value="">Manual client ID</option>
              {(rules.data ?? []).map((rule) => (
                <option key={rule.client_id} value={rule.client_id}>
                  {rule.client_id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Manual client ID">
            <input className={inputClass} value={manualClientId} onChange={(event) => setManualClientId(event.target.value)} disabled={selectedClientId.length > 0} />
          </Field>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatusBadge label={`State: ${state}`} tone={state === 'Sending' ? 'solid' : 'outline'} />
            <StatusBadge label={selectedRule ? selectedRule.algorithm : 'Default config'} tone="outline" />
            <StatusBadge label={`Limit: ${selectedRule?.limit ?? 'Default'}`} tone="outline" />
            <StatusBadge label={`Fail: ${selectedRule?.fail_mode ?? 'Not exposed'}`} tone="dashed" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {burstSizes.map((size) => (
              <Button key={size} variant="primary" disabled={state === 'Sending'} onClick={() => void fireBurst(size)}>
                Fire {size}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={state !== 'Sending'} onClick={() => abortRef.current?.abort()}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => setRows([])}>
              Clear log
            </Button>
          </div>
          <div className="rounded-lg border border-ink-700 bg-ink-800 p-4 text-sm">
            <p className="metric-font">Sent {summary.sent} | Allowed {summary.allowed} | Rejected {summary.rejected} | Failed {summary.failed}</p>
            <p className="mt-2 text-ink-300">Average duration: {summary.sent ? `${(summary.totalDuration / Math.max(1, summary.allowed + summary.rejected)).toFixed(1)} ms` : 'Unavailable'}</p>
            <p className="text-ink-300">First rejection: {summary.firstRejected ?? 'None'} | Retry-After: {summary.retryAfter ?? 'Unavailable'}s</p>
          </div>
        </div>
      </Panel>
      <Panel className="min-w-0">
        <h2 className="text-xl font-semibold">Response log</h2>
        <p className="mt-2 text-sm text-ink-300">`X-RateLimit-Reset` is rendered as epoch milliseconds. `Retry-After` is seconds.</p>
        <div className="mt-4 overflow-x-auto" aria-live="polite">
          {rows.length === 0 ? (
            <EmptyState title="No requests fired" message="Choose a client and fire a burst to inspect response headers." />
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-ink-800 text-xs uppercase tracking-[0.16em] text-ink-500">
                <tr>
                  {['#', 'Time', 'Status', 'Limit', 'Remaining', 'Reset', 'Retry', 'Duration', 'Error'].map((heading) => (
                    <th key={heading} className="px-3 py-2 text-left">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.sequence} className={`border-t border-ink-700 ${index === rows.length - 1 ? 'bg-accent-500/15' : row.status === 429 ? 'border-l-2 border-dashed border-l-ink-500' : ''}`}>
                    <td className="metric-font px-3 py-2">{row.sequence}</td>
                    <td className="metric-font px-3 py-2">{row.timestamp}</td>
                    <td className="metric-font px-3 py-2">{row.status}</td>
                    <td className="metric-font px-3 py-2">{row.limit ?? '-'}</td>
                    <td className="metric-font px-3 py-2">{row.remaining ?? '-'}</td>
                    <td className="metric-font px-3 py-2">{row.reset}</td>
                    <td className="metric-font px-3 py-2">{row.retryAfter ?? '-'}</td>
                    <td className="metric-font px-3 py-2">{row.durationMs == null ? '-' : row.durationMs.toFixed(1)}</td>
                    <td className="px-3 py-2">{row.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  )
}
