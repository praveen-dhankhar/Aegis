import { Link } from 'react-router-dom'
import { Panel } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Not found')
  return (
    <Panel>
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <p className="mt-2 text-ink-300">The requested Aegis control-plane route does not exist.</p>
      <Link className="mt-6 inline-flex rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-accent-300" to="/">
        Return to overview
      </Link>
    </Panel>
  )
}
