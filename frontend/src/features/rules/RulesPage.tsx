import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { createRateLimit, deleteRateLimit, listRateLimits, updateRateLimit } from '../../api/rateLimits'
import type { CreateRateLimitRequest, RateLimitConfig, UpdateRateLimitRequest } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, EmptyState, ErrorState, LoadingSkeleton, Panel, StatusBadge } from '../../components/ui'
import { useRefreshControls } from '../../app/RefreshContext'
import { useAuth } from '../auth/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useVisiblePolling } from '../../hooks/useVisiblePolling'
import { formatWindow } from '../../lib/format'
import { queryKeys } from '../../lib/queryKeys'
import { RuleForm } from './RuleForm'

type SortKey = 'client_id' | 'algorithm' | 'limit' | 'window_ms' | 'fail_mode'

function sortRules(rules: RateLimitConfig[], sortKey: SortKey): RateLimitConfig[] {
  return [...rules].sort((left, right) => {
    const a = left[sortKey]
    const b = right[sortKey]
    return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
  })
}

export function RulesPage() {
  useDocumentTitle('Rules')
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const { adminKey, isAuthenticated, clearOnUnauthorized } = useAuth()
  const { refreshInterval, refreshNonce } = useRefreshControls()
  const polling = useVisiblePolling(refreshInterval)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('client_id')
  const [editing, setEditing] = useState<RateLimitConfig | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RateLimitConfig | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const rules = useQuery({
    queryKey: queryKeys.rules,
    queryFn: ({ signal }) => listRateLimits(signal),
    refetchInterval: polling,
  })
  const refetchRules = rules.refetch

  useEffect(() => {
    if (refreshNonce > 0) void refetchRules()
  }, [refreshNonce, refetchRules])

  const sortedRules = useMemo(() => sortRules(rules.data ?? [], sortKey), [rules.data, sortKey])

  const createMutation = useMutation({
    mutationFn: (payload: CreateRateLimitRequest) => createRateLimit(payload, adminKey ?? ''),
    onSuccess: (created) => {
      queryClient.setQueryData<RateLimitConfig[]>(queryKeys.rules, (current = []) => [...current.filter((item) => item.client_id !== created.client_id), created])
      setEditing(null)
    },
    onError: (error) => {
      clearOnUnauthorized(error)
      setMutationError('Create failed. Check the admin key and validation fields.')
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.rules }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ clientId, payload }: { clientId: string; payload: UpdateRateLimitRequest }) => updateRateLimit(clientId, payload, adminKey ?? ''),
    onMutate: async ({ clientId, payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.rules })
      const previousRules = queryClient.getQueryData<RateLimitConfig[]>(queryKeys.rules)
      queryClient.setQueryData<RateLimitConfig[]>(queryKeys.rules, (current = []) =>
        current.map((item) => (item.client_id === clientId ? { ...item, ...payload, client_id: clientId } : item)),
      )
      return { previousRules }
    },
    onError: (error, _variables, context) => {
      clearOnUnauthorized(error)
      queryClient.setQueryData(queryKeys.rules, context?.previousRules)
      setMutationError('Update failed. The cached row was rolled back.')
    },
    onSuccess: () => setEditing(null),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.rules }),
  })

  const deleteMutation = useMutation({
    mutationFn: (clientId: string) => deleteRateLimit(clientId, adminKey ?? ''),
    onMutate: async (clientId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.rules })
      const previousRules = queryClient.getQueryData<RateLimitConfig[]>(queryKeys.rules)
      queryClient.setQueryData<RateLimitConfig[]>(queryKeys.rules, (current = []) => current.filter((item) => item.client_id !== clientId))
      return { previousRules }
    },
    onError: (error, _variables, context) => {
      clearOnUnauthorized(error)
      queryClient.setQueryData(queryKeys.rules, context?.previousRules)
      setMutationError('Delete failed. The cached row was rolled back.')
    },
    onSuccess: () => setDeleteTarget(null),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.rules }),
  })

  function ensureAuth(action: () => void) {
    if (!isAuthenticated) {
      openAuth()
      return
    }
    setMutationError(null)
    action()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Rate-limit rules</h2>
          <p className="text-sm text-ink-300">Reads are public when the backend permits them. Writes require an in-memory admin key.</p>
        </div>
        <Button variant="primary" onClick={() => ensureAuth(() => setEditing('new'))}>
          {isAuthenticated ? 'Create rule' : 'Sign in to edit'}
        </Button>
      </div>

      {mutationError ? <ErrorState title="Mutation failed" message={mutationError} /> : null}

      <Panel className="overflow-hidden p-0">
        {rules.isLoading ? <div className="p-5"><LoadingSkeleton lines={6} /></div> : null}
        {rules.isError ? <div className="p-5"><ErrorState message="Rules could not be loaded." onRetry={() => void rules.refetch()} /></div> : null}
        {!rules.isLoading && !rules.isError && sortedRules.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No explicit rules" message="The backend will use the default rate-limiter configuration for clients without stored configs." />
          </div>
        ) : null}
        {sortedRules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-ink-800 text-xs uppercase tracking-[0.16em] text-ink-500">
                <tr>
                  {[
                    ['client_id', 'Client ID'],
                    ['algorithm', 'Algorithm'],
                    ['limit', 'Limit'],
                    ['window_ms', 'Window'],
                    ['fail_mode', 'Fail mode'],
                  ].map(([key, label]) => (
                    <th key={key} className="px-4 py-3 text-left">
                      <button type="button" onClick={() => setSortKey(key as SortKey)}>
                        {label}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Burst</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRules.map((rule) => (
                  <tr
                    key={rule.client_id}
                    tabIndex={0}
                    className="border-t border-ink-700 hover:bg-ink-800/50 focus:bg-ink-800"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') navigate(`/rules/${encodeURIComponent(rule.client_id)}`)
                      if (event.key.toLowerCase() === 'e') ensureAuth(() => setEditing(rule))
                      if (event.key === 'Delete' || event.key === 'Backspace') ensureAuth(() => setDeleteTarget(rule))
                    }}
                  >
                    <td className="metric-font px-4 py-3"><Link to={`/rules/${encodeURIComponent(rule.client_id)}`}>{rule.client_id}</Link></td>
                    <td className="px-4 py-3"><StatusBadge label={rule.algorithm.replaceAll('_', ' ')} tone="outline" /></td>
                    <td className="metric-font px-4 py-3 text-right">{rule.limit}</td>
                    <td className="metric-font px-4 py-3 text-right">{formatWindow(rule.window_ms)}</td>
                    <td className="px-4 py-3"><StatusBadge label={rule.fail_mode} tone={rule.fail_mode === 'OPEN' ? 'solid' : 'dashed'} /></td>
                    <td className="metric-font px-4 py-3 text-right">{rule.burst_capacity}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => navigate(`/rules/${encodeURIComponent(rule.client_id)}`)}>View</Button>
                        <Button variant="ghost" onClick={() => ensureAuth(() => setEditing(rule))}>{isAuthenticated ? 'Edit' : 'Sign in'}</Button>
                        <Button variant="ghost" onClick={() => ensureAuth(() => setDeleteTarget(rule))}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {editing ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/70" role="dialog" aria-modal="true" aria-labelledby="rule-form-title">
          <button className="flex-1 cursor-default" aria-label="Close rule form" onClick={() => setEditing(null)} />
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-ink-700 bg-ink-900 p-6">
            <h2 id="rule-form-title" className="mb-6 text-xl font-semibold">{editing === 'new' ? 'Create rule' : `Edit ${editing.client_id}`}</h2>
            <RuleForm
              mode={editing === 'new' ? 'create' : 'edit'}
              config={editing === 'new' ? undefined : editing}
              existingClientIds={(rules.data ?? []).map((item) => item.client_id)}
              submitting={createMutation.isPending || updateMutation.isPending}
              error={mutationError}
              onCancel={() => setEditing(null)}
              onSubmit={(payload) => {
                if (editing === 'new') {
                  createMutation.mutate(payload as CreateRateLimitRequest)
                } else {
                  updateMutation.mutate({ clientId: editing.client_id, payload: payload as UpdateRateLimitRequest })
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        title={`Delete ${deleteTarget?.client_id ?? 'rule'}?`}
        message="Deletion removes the explicit rule. The next request for this client may use the backend default configuration."
        confirmLabel="Delete rule"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.client_id)}
      />
    </div>
  )
}
