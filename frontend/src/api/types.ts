export type Algorithm = 'TOKEN_BUCKET' | 'SLIDING_WINDOW' | 'FIXED_WINDOW'
export type FailMode = 'OPEN' | 'CLOSED'

export interface RateLimitConfig {
  client_id: string
  algorithm: Algorithm
  limit: number
  window_ms: number
  burst_capacity: number
  fail_mode: FailMode
}

export interface CreateRateLimitRequest {
  client_id: string
  algorithm: Algorithm
  limit: number
  window_ms: number
  burst_capacity?: number
  fail_mode?: FailMode
}

export interface UpdateRateLimitRequest {
  algorithm?: Algorithm
  limit?: number
  window_ms?: number
  burst_capacity?: number
  fail_mode?: FailMode
}

export interface ClientDetail {
  client_id: string
  config: RateLimitConfig
  stats: Record<string, unknown>
}

export interface HealthResponse {
  status?: string
  components?: Record<string, { status?: string; details?: Record<string, unknown> }>
}

export interface ApiErrorBody {
  error?: string
  message?: string
  [key: string]: unknown
}

export class ApiError extends Error {
  status: number
  code: string
  body: ApiErrorBody | string | null

  constructor(status: number, code: string, message: string, body: ApiErrorBody | string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export interface RateLimitHeaders {
  limit: number | null
  remaining: number | null
  resetEpochMs: number | null
  retryAfterSeconds: number | null
}

export interface SandboxResponse {
  status: number
  ok: boolean
  durationMs: number
  headers: RateLimitHeaders
  body: unknown
}
