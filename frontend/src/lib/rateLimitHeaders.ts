import type { RateLimitHeaders } from '../api/types'

function numberHeader(headers: Headers, name: string): number | null {
  const value = headers.get(name)
  if (value == null || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseRateLimitHeaders(headers: Headers): RateLimitHeaders {
  return {
    limit: numberHeader(headers, 'X-RateLimit-Limit'),
    remaining: numberHeader(headers, 'X-RateLimit-Remaining'),
    resetEpochMs: numberHeader(headers, 'X-RateLimit-Reset'),
    retryAfterSeconds: numberHeader(headers, 'Retry-After'),
  }
}

export function resetLabel(resetEpochMs: number | null): string {
  if (resetEpochMs == null) {
    return 'Unavailable'
  }
  const date = new Date(resetEpochMs)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleTimeString()
}
