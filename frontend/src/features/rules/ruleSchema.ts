import { z } from 'zod'
import type { Algorithm, CreateRateLimitRequest, FailMode, RateLimitConfig, UpdateRateLimitRequest } from '../../api/types'

export const algorithms = ['TOKEN_BUCKET', 'SLIDING_WINDOW', 'FIXED_WINDOW'] as const satisfies readonly Algorithm[]
export const failModes = ['OPEN', 'CLOSED'] as const satisfies readonly FailMode[]

export const ruleFormSchema = z.object({
  client_id: z.string().trim().min(1, 'Client ID is required').max(96, 'Client ID must be 96 characters or fewer before backend sanitization'),
  algorithm: z.enum(algorithms),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1'),
  window_ms: z.coerce.number().int().min(1, 'Window must be at least 1 ms'),
  burst_capacity: z.coerce.number().int().min(1, 'Burst capacity must be at least 1').optional(),
  fail_mode: z.enum(failModes),
})

export type RuleFormValues = z.infer<typeof ruleFormSchema>
export type RuleFormInput = z.input<typeof ruleFormSchema>

export function defaultsFromConfig(config?: RateLimitConfig): RuleFormValues {
  return {
    client_id: config?.client_id ?? '',
    algorithm: config?.algorithm ?? 'SLIDING_WINDOW',
    limit: config?.limit ?? 100,
    window_ms: config?.window_ms ?? 60000,
    burst_capacity: config?.burst_capacity ?? config?.limit ?? 100,
    fail_mode: config?.fail_mode ?? 'OPEN',
  }
}

export function toCreatePayload(values: RuleFormValues): CreateRateLimitRequest {
  return {
    client_id: values.client_id,
    algorithm: values.algorithm,
    limit: values.limit,
    window_ms: values.window_ms,
    burst_capacity: values.algorithm === 'TOKEN_BUCKET' ? values.burst_capacity : values.limit,
    fail_mode: values.fail_mode,
  }
}

export function toUpdatePayload(values: RuleFormValues): UpdateRateLimitRequest {
  return {
    algorithm: values.algorithm,
    limit: values.limit,
    window_ms: values.window_ms,
    burst_capacity: values.algorithm === 'TOKEN_BUCKET' ? values.burst_capacity : values.limit,
    fail_mode: values.fail_mode,
  }
}
