import { apiRequest } from './client'

export function validateAdminKey(adminKey: string, signal?: AbortSignal): Promise<void> {
  return apiRequest<void>('/admin/auth/validate', { adminKey, signal })
}
