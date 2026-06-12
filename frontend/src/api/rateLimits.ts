import { apiRequest } from './client'
import type { ClientDetail, CreateRateLimitRequest, RateLimitConfig, UpdateRateLimitRequest } from './types'

export function listRateLimits(signal?: AbortSignal): Promise<RateLimitConfig[]> {
  return apiRequest<RateLimitConfig[]>('/admin/rate-limits', { signal })
}

export function getRateLimit(clientId: string, signal?: AbortSignal): Promise<ClientDetail> {
  return apiRequest<ClientDetail>(`/admin/rate-limits/${encodeURIComponent(clientId)}`, { signal })
}

export function createRateLimit(payload: CreateRateLimitRequest, adminKey: string): Promise<RateLimitConfig> {
  return apiRequest<RateLimitConfig>('/admin/rate-limits', {
    method: 'POST',
    adminKey,
    body: JSON.stringify(payload),
  })
}

export function updateRateLimit(clientId: string, payload: UpdateRateLimitRequest, adminKey: string): Promise<RateLimitConfig> {
  return apiRequest<RateLimitConfig>(`/admin/rate-limits/${encodeURIComponent(clientId)}`, {
    method: 'PUT',
    adminKey,
    body: JSON.stringify(payload),
  })
}

export function deleteRateLimit(clientId: string, adminKey: string): Promise<void> {
  return apiRequest<void>(`/admin/rate-limits/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
    adminKey,
  })
}
