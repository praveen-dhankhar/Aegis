import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { deleteRateLimit, getRateLimit, updateRateLimit } from '../../api/rateLimits'
import type { RateLimitConfig, UpdateRateLimitRequest } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, ErrorState, LoadingSkeleton, Panel, StatusBadge } from '../../components/ui'
import { useRefreshControls } from '../../app/RefreshContext'
import { useAuth } from '../auth/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useVisiblePolling } from '../../hooks/useVisiblePolling'
import { formatWindow } from '../../lib/format'
import { queryKeys } from '../../lib/queryKeys'
import { RuleForm } from './RuleForm'

function renderStat(value: unknown): string {
  if (value == null) return 'Unavailable'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function ClientDetailPage() {
  const { clientId = '' } = useParams()
  useDocumentTitle(clientId || 'Client detail')
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const { adminKey, isAuthenticated, clearOnUnauthorized } = useAuth()
  const { refreshInterval, refreshNonce } = useRefreshControls()
  const polling = useVisiblePolling(refreshInterval)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detail = useQuery({
    queryKey: queryKeys.rule(clientId),
    queryFn: ({ signal }) => getRateLimit(clientId, signal),
    refetchInterval: polling,
    enabled: clientId.length > 0,
  })
  const refetchDetail = detail.refetch

  useEffect(() => {
    if (refreshNonce > 0) void refetchDetail()
  }, [refreshNonce, refetchDetail])

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateRateLimitRequest) => updateRateLimit(clientId, payload, adminKey ?? ''),
    onSuccess: () => {
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.rule(clientId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.rules })
    },
    onError: (mutationError) => {
      clearOnUnauthorized(mutationError)
      setError('Update failed. Check the admin key and submitted values.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRateLimit(clientId, adminKey ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rules })
      navigate('/rules')
    },
    onError: (mutationError) => {
      clearOnUnauthorized(mutationError)
      setError('Delete failed. Check the admin key and retry.')
    },
  })

  function ensureAuth(action: () => void) {
    if (!isAuthenticated) {
      openAuth()
      return
    }
    action()
  }

  if (detail.isLoading) {
    return <LoadingSkeleton lines={8} />
  }
  if (detail.isError || !detail.data) {
    return <ErrorState title="Client unavailable" message="The client detail endpoint could not be loaded." onRetry={() => void detail.refetch()} />
  }

  const config: RateLimitConfig = detail.data.config

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/rules" className="text-sm text-ink-300 hover:text-ink-100">Back to rules</Link>
          <h2 className="metric-font mt-2 text-2xl font-semibold">{detail.data.client_id}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => ensureAuth(() => setEditing(true))}>{isAuthenticated ? 'Edit' : 'Sign in to edit'}</Button>
          <Button variant="danger" onClick={() => ensureAuth(() => setConfirmDelete(true))}>Delete</Button>
        </div>
      </div>
      {error ? <ErrorState title="Action failed" message={error} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="text-lg font-semibold">Configuration</h3>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ink-300">Algorithm</dt><dd><StatusBadge label={config.algorithm} tone="outline" /></dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-300">Limit</dt><dd className="metric-font">{config.limit}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-300">Window</dt><dd className="metric-font">{formatWindow(config.window_ms)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-300">Burst capacity</dt><dd className="metric-font">{config.burst_capacity}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-300">Fail mode</dt><dd><StatusBadge label={config.fail_mode} tone={config.fail_mode === 'OPEN' ? 'solid' : 'dashed'} /></dd></div>
          </dl>
        </Panel>
        <Panel>
          <h3 className="text-lg font-semibold">Live statistics</h3>
          <p className="mt-1 text-sm text-ink-300">The backend exposes algorithm-specific Redis state, not normalized per-minute counters.</p>
          <dl className="mt-4 space-y-3 text-sm">
            {Object.entries(detail.data.stats ?? {}).map(([key, value]) => (
              <div key={key} className="grid gap-1 border-b border-ink-800 pb-3">
                <dt className="text-ink-300">{key}</dt>
                <dd className="metric-font break-all">{renderStat(value)}</dd>
              </div>
            ))}
            {Object.keys(detail.data.stats ?? {}).length === 0 ? <p className="text-sm text-ink-300">No statistics are currently exposed for this client.</p> : null}
          </dl>
        </Panel>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/70" role="dialog" aria-modal="true" aria-labelledby="detail-edit-title">
          <button className="flex-1 cursor-default" aria-label="Close edit form" onClick={() => setEditing(false)} />
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-ink-700 bg-ink-900 p-6">
            <h2 id="detail-edit-title" className="mb-6 text-xl font-semibold">Edit {config.client_id}</h2>
            <RuleForm
              mode="edit"
              config={config}
              submitting={updateMutation.isPending}
              error={error}
              onCancel={() => setEditing(false)}
              onSubmit={(payload) => updateMutation.mutate(payload as UpdateRateLimitRequest)}
            />
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${config.client_id}?`}
        message="Deletion removes the explicit rule. This page will return to the rules table and the backend default may apply to future requests."
        confirmLabel="Delete rule"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  )
}
