import { describe, expect, it } from 'vitest'
import { parseRateLimitHeaders, resetLabel } from './rateLimitHeaders'

describe('parseRateLimitHeaders', () => {
  it('parses headers case insensitively', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '10',
      'x-ratelimit-remaining': '2',
      'x-ratelimit-reset': '1710000000000',
      'retry-after': '5',
    })
    expect(parseRateLimitHeaders(headers)).toEqual({ limit: 10, remaining: 2, resetEpochMs: 1710000000000, retryAfterSeconds: 5 })
  })

  it('returns null for missing or invalid values', () => {
    const headers = new Headers({ 'x-ratelimit-limit': 'NaN' })
    expect(parseRateLimitHeaders(headers).limit).toBeNull()
    expect(resetLabel(null)).toBe('Unavailable')
  })
})
