import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getHealth } from '../../api/health'
import { getPrometheusText } from '../../api/metrics'
import { ErrorState, LoadingSkeleton, Panel, StatusBadge } from '../../components/ui'
import { useRefreshControls } from '../../app/RefreshContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useVisiblePolling } from '../../hooks/useVisiblePolling'
import { formatMs, formatNumber, formatPercent } from '../../lib/format'
import { parsePromText, sumSamples, type MetricSample } from '../../lib/prometheus'
import { appendBounded } from '../../lib/rollingBuffer'
import { counterRate, ratio, type CounterSnapshot } from '../../lib/rates'

interface TrafficPoint {
  time: string
  allowed: number
  rejected: number
}

function MetricCard({ label, value, context }: { label: string; value: string; context: string }) {
  return (
    <Panel>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p className="metric-font mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-ink-300">{context}</p>
    </Panel>
  )
}

function redisLatencyMs(samples: MetricSample[]): number | null {
  const max = sumSamples(samples, 'rate_limit_redis_latency_ms_seconds_max')
  if (max != null) {
    return max * 1000
  }
  const sum = sumSamples(samples, 'rate_limit_redis_latency_ms_seconds_sum')
  const count = sumSamples(samples, 'rate_limit_redis_latency_ms_seconds_count')
  if (sum == null || count == null || count <= 0) {
    return null
  }
  return (sum / count) * 1000
}

export function OverviewPage() {
  useDocumentTitle('Overview')
  const { refreshInterval, refreshNonce } = useRefreshControls()
  const polling = useVisiblePolling(refreshInterval)
  const [traffic, setTraffic] = useState<TrafficPoint[]>([])
  const previous = useRef<{ allowed: CounterSnapshot; rejected: CounterSnapshot } | null>(null)

  const health = useQuery({
    queryKey: ['health', refreshNonce],
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: polling,
  })

  const metrics = useQuery({
    queryKey: ['prometheus', refreshNonce],
    queryFn: ({ signal }) => getPrometheusText(signal),
    refetchInterval: polling,
  })

  const parsed = useMemo(() => (metrics.data ? parsePromText(metrics.data) : []), [metrics.data])
  const now = metrics.dataUpdatedAt
  const allowedTotal = sumSamples(parsed, 'rate_limit_requests_total', { result: 'allowed' }) ?? sumSamples(parsed, 'rate_limit_allowed_total')
  const rejectedTotal = sumSamples(parsed, 'rate_limit_requests_total', { result: 'rejected' }) ?? sumSamples(parsed, 'rate_limit_rejected_total')
  const current = {
    allowed: { value: allowedTotal, sampledAt: now },
    rejected: { value: rejectedTotal, sampledAt: now },
  }
  const allowedRate = counterRate(previous.current?.allowed ?? null, current.allowed)
  const rejectedRate = counterRate(previous.current?.rejected ?? null, current.rejected)
  const rejectionRatio = ratio(rejectedRate, (allowedRate ?? 0) + (rejectedRate ?? 0))
  const redisErrors = sumSamples(parsed, 'rate_limit_redis_errors_total')
  const latency = redisLatencyMs(parsed)

  useEffect(() => {
    if (!metrics.data) {
      return
    }
    if (allowedRate != null || rejectedRate != null) {
      setTraffic((items) =>
        appendBounded(items, {
          time: new Date().toLocaleTimeString(),
          allowed: Number((allowedRate ?? 0).toFixed(2)),
          rejected: Number((rejectedRate ?? 0).toFixed(2)),
        }),
      )
    }
    previous.current = current
    // We intentionally update the rolling buffer only when a fresh metrics payload arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics.data])

  if (metrics.isLoading && health.isLoading) {
    return <LoadingSkeleton lines={8} />
  }

  if (metrics.isError) {
    return <ErrorState message="Prometheus metrics could not be loaded." onRetry={() => void metrics.refetch()} />
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Allowed requests/sec" value={allowedRate == null ? 'Collecting baseline' : formatNumber(allowedRate)} context="Derived from monotonic counters" />
        <MetricCard label="Rejected requests/sec" value={rejectedRate == null ? 'Collecting baseline' : formatNumber(rejectedRate)} context="Grayscale rejected series" />
        <MetricCard label="Rejection ratio" value={formatPercent(rejectionRatio)} context="Rejected divided by total traffic" />
        <MetricCard label="Redis latency" value={formatMs(latency)} context={latency == null ? 'Metric not exposed yet' : 'Micrometer timer max when available'} />
      </div>

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Traffic</h2>
            <p className="text-sm text-ink-300">Rolling client-side history, capped at 60 samples.</p>
          </div>
          <span className="sr-only">Allowed traffic uses the accent series; rejected traffic uses the grayscale series.</span>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={traffic} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--ink-800)" />
              <XAxis dataKey="time" stroke="var(--ink-500)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--ink-500)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--paper-0)', color: 'var(--ink-950)', border: 0 }} />
              <Area type="monotone" dataKey="allowed" stroke="var(--accent-500)" fill="var(--accent-500)" fillOpacity={0.25} name="Allowed/sec" />
              <Area type="monotone" dataKey="rejected" stroke="var(--ink-500)" fill="var(--ink-700)" fillOpacity={0.45} name="Rejected/sec" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <h2 className="text-lg font-semibold">Rejection gauge</h2>
          <div className="mt-6" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rejectionRatio == null ? undefined : Math.round(rejectionRatio * 100)}>
            <div className="h-3 rounded-full bg-ink-800">
              <div className="h-3 rounded-full bg-accent-500" style={{ width: `${Math.max(0, Math.min(100, (rejectionRatio ?? 0) * 100))}%` }} />
            </div>
            <p className="metric-font mt-4 text-2xl">{formatPercent(rejectionRatio)}</p>
            <p className="text-sm text-ink-300">Status remains textual and readable without color.</p>
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold">Health</h2>
          <div className="mt-4 space-y-3">
            <StatusBadge label={`Application: ${health.data?.status ?? 'Unavailable'}`} tone={health.data?.status === 'UP' ? 'solid' : 'dashed'} />
            <StatusBadge label={`Redis: ${health.data?.components?.redis?.status ?? 'Unavailable'}`} tone={health.data?.components?.redis?.status === 'UP' ? 'solid' : 'dashed'} />
            <StatusBadge label={`Redis errors total: ${redisErrors == null ? 'Not exposed' : formatNumber(redisErrors, 0)}`} tone="outline" />
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold">Implementation exposure</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-300">Circuit breaker state</dt>
              <dd className="metric-font">Not exposed</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-300">Default fail mode</dt>
              <dd className="metric-font">Not exposed</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-300">Last refresh</dt>
              <dd className="metric-font">{new Date().toLocaleTimeString()}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  )
}
