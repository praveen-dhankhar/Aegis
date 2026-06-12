import { endpoint } from './client'
import { parseRateLimitHeaders } from '../lib/rateLimitHeaders'
import type { SandboxResponse } from './types'

export async function fireSandboxRequest(clientId: string, signal?: AbortSignal): Promise<SandboxResponse> {
  const started = performance.now()
  let response: Response
  try {
    response = await fetch(endpoint('/api/test'), {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/json',
        'X-API-Key': clientId,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new Error(error instanceof Error ? error.message : 'Sandbox request failed')
  }

  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(() => null)
  return {
    status: response.status,
    ok: response.ok,
    durationMs: performance.now() - started,
    headers: parseRateLimitHeaders(response.headers),
    body,
  }
}
