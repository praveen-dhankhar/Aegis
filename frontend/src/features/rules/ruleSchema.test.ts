import { describe, expect, it } from 'vitest'
import { ruleFormSchema, toCreatePayload, toUpdatePayload } from './ruleSchema'

describe('rule schema', () => {
  it('validates positive integer fields', () => {
    const result = ruleFormSchema.safeParse({ client_id: 'a', algorithm: 'TOKEN_BUCKET', limit: 1, window_ms: 1000, burst_capacity: 2, fail_mode: 'OPEN' })
    expect(result.success).toBe(true)
  })

  it('normalizes non-token-bucket burst capacity to limit', () => {
    const values = { client_id: 'a', algorithm: 'SLIDING_WINDOW' as const, limit: 5, window_ms: 1000, burst_capacity: 20, fail_mode: 'CLOSED' as const }
    expect(toCreatePayload(values).burst_capacity).toBe(5)
    expect(toUpdatePayload(values).burst_capacity).toBe(5)
  })
})
