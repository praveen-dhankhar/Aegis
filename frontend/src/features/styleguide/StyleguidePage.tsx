import { Button, EmptyState, ErrorState, LoadingSkeleton, Panel, StatusBadge } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export function StyleguidePage() {
  useDocumentTitle('Styleguide')
  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-2xl font-semibold">Design tokens</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {['ink-950', 'ink-900', 'ink-800', 'ink-700', 'ink-500', 'ink-300', 'ink-100', 'paper-0', 'accent-500', 'accent-300'].map((token) => (
            <div key={token} className="rounded border border-ink-700 p-3">
              <div className="h-12 rounded" style={{ background: `var(--${token})` }} />
              <p className="metric-font mt-2 text-xs">{token}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2 className="text-xl font-semibold">Components</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Destructive</Button>
          <StatusBadge label="Solid" tone="solid" />
          <StatusBadge label="Outline" tone="outline" />
          <StatusBadge label="Dashed" tone="dashed" />
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel><LoadingSkeleton lines={4} /></Panel>
        <EmptyState title="Empty state" message="No data is available." />
        <ErrorState message="An example error state." />
      </div>
    </div>
  )
}
