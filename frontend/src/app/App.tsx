import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LoadingSkeleton } from '../components/ui'
import { AuthProvider } from '../features/auth/AuthContext'
import { LoginPage } from '../features/auth/LoginPage'
import { OverviewPage } from '../features/overview/OverviewPage'
import { ClientDetailPage } from '../features/rules/ClientDetailPage'
import { RulesPage } from '../features/rules/RulesPage'
import { NotFoundPage } from '../routes/NotFoundPage'
import { AppShell } from './AppShell'
import { RefreshProvider } from './RefreshContext'

const SandboxPage = lazy(() => import('../features/sandbox/SandboxPage').then((module) => ({ default: module.SandboxPage })))
const AlgorithmsPage = lazy(() => import('../features/algorithms/AlgorithmsPage').then((module) => ({ default: module.AlgorithmsPage })))
const StyleguidePage = lazy(() => import('../features/styleguide/StyleguidePage').then((module) => ({ default: module.StyleguidePage })))

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/rules', element: <RulesPage /> },
      { path: '/rules/:clientId', element: <ClientDetailPage /> },
      {
        path: '/sandbox',
        element: (
          <Suspense fallback={<LoadingSkeleton lines={6} />}>
            <SandboxPage />
          </Suspense>
        ),
      },
      {
        path: '/algorithms',
        element: (
          <Suspense fallback={<LoadingSkeleton lines={6} />}>
            <AlgorithmsPage />
          </Suspense>
        ),
      },
      {
        path: '/styleguide',
        element: (
          <Suspense fallback={<LoadingSkeleton lines={6} />}>
            <StyleguidePage />
          </Suspense>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RefreshProvider>
          <RouterProvider router={router} />
        </RefreshProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
