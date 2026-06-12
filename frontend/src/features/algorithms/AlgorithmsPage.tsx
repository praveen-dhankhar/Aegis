import { Link } from 'react-router-dom'
import { Panel, StatusBadge } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

const rows = [
  ['Token Bucket', 'Hash', 'Smooth refill with controlled bursts', 'O(1)', 'API clients that need short bursts without sustained excess'],
  ['Sliding Window Log', 'Sorted set', 'Exact rolling-window enforcement', 'O(log n)', 'Strict fairness where memory cost is acceptable'],
  ['Fixed Window', 'String counter', 'Fastest and simplest', 'O(1)', 'High-throughput coarse limits where boundary bursts are acceptable'],
]

export function AlgorithmsPage() {
  useDocumentTitle('Algorithms')
  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-2xl font-semibold">Algorithm comparison</h2>
        <p className="mt-2 max-w-3xl text-sm text-ink-300">
          The backend executes each decision through Redis Lua, keeping the rate-limit check atomic across service instances without client-side Redis transaction retries.
        </p>
      </Panel>
      <Panel className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-ink-500">
            <tr>{['Algorithm', 'Redis storage', 'Burst behavior', 'Complexity', 'Use case'].map((item) => <th key={item} className="px-3 py-3 text-left">{item}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-t border-ink-700">
                {row.map((cell, index) => <td key={cell} className={`px-3 py-3 ${index === 0 || index === 3 ? 'metric-font' : ''}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <StatusBadge label="TOKEN_BUCKET" tone="solid" />
          <h3 className="mt-4 text-lg font-semibold">Token Bucket</h3>
          <p className="mt-2 text-sm text-ink-300">Stores tokens and last refill time in a Redis hash. It supports bursts up to `burst_capacity` and refills at `limit / window_ms`.</p>
        </Panel>
        <Panel>
          <StatusBadge label="SLIDING_WINDOW" tone="outline" />
          <h3 className="mt-4 text-lg font-semibold">Sliding Window Log</h3>
          <p className="mt-2 text-sm text-ink-300">Stores exact request timestamps in a sorted set. It is the most precise limiter and the most memory-intensive under high traffic.</p>
        </Panel>
        <Panel>
          <StatusBadge label="FIXED_WINDOW" tone="dashed" />
          <h3 className="mt-4 text-lg font-semibold">Fixed Window</h3>
          <p className="mt-2 text-sm text-ink-300">Uses a counter per time bucket. It was fastest in the local JMH benchmark but permits boundary bursts around window rollover.</p>
        </Panel>
      </div>
      <Panel>
        <h3 className="text-lg font-semibold">Repository benchmark references</h3>
        <p className="mt-2 text-sm text-ink-300">README measurements from June 10, 2026: Fixed Window `3,147,577.434 ops/sec`, Token Bucket `2,347,091.463 ops/sec`, Sliding Window Log `126,631.897 ops/sec`; Dockerized k6 reached `27,844.075 req/sec` with expected `200` and `429` outcomes.</p>
      </Panel>
      <Panel>
        <h3 className="text-lg font-semibold">Engineering trade-offs</h3>
        <div className="mt-4 grid gap-3 text-sm text-ink-300 md:grid-cols-2">
          <p>Lua scripts keep each decision to a single Redis round trip and preserve atomicity under distributed concurrency.</p>
          <p>Fail-open avoids turning Redis outages into application outages; fail-closed is available for security-sensitive clients.</p>
          <p>Immediate Redis reads keep instances consistent. Local caching is limited to config lookup and expires quickly.</p>
          <p>Clock handling is centralized in the service and reset headers are emitted as epoch milliseconds.</p>
        </div>
        <div className="mt-6 flex gap-3">
          <Link className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950" to="/sandbox">Open sandbox</Link>
          <Link className="rounded-md border border-ink-700 px-4 py-2 text-sm font-medium text-ink-100" to="/rules">Manage rules</Link>
        </div>
      </Panel>
    </div>
  )
}
