import { ApiError, type ApiErrorBody } from './types'

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
export const metricsRefreshMs = Number(import.meta.env.VITE_METRICS_REFRESH_MS ?? 5000)
export const rulesRefreshMs = Number(import.meta.env.VITE_RULES_REFRESH_MS ?? 10000)

interface RequestOptions extends RequestInit {
  adminKey?: string | null
}

export function endpoint(path: string): string {
  if (path.startsWith('http')) {
    return path
  }
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

export function normalizeError(status: number, body: unknown): ApiError {
  const errorBody = body as ApiErrorBody | null
  const code = typeof errorBody?.error === 'string' ? errorBody.error : `http_${status}`
  const messages: Record<number, string> = {
    400: 'The request was rejected by validation.',
    401: 'The admin key was rejected.',
    404: 'The requested resource was not found.',
    409: 'The request conflicts with existing state.',
    429: 'The request was rate limited.',
    500: 'The server returned an internal error.',
  }
  return new ApiError(status, code, messages[status] ?? `Request failed with status ${status}`, body as ApiErrorBody | string | null)
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.adminKey) {
    headers.set('X-Admin-Key', options.adminKey)
  }

  let response: Response
  try {
    response = await fetch(endpoint(path), { ...options, headers })
  } catch (error) {
    throw new ApiError(0, 'network_error', error instanceof Error ? error.message : 'Network request failed')
  }

  const body = await parseBody(response)
  if (!response.ok) {
    throw normalizeError(response.status, body)
  }
  return body as T
}
