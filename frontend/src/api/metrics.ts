import { endpoint } from './client'

export async function getPrometheusText(signal?: AbortSignal): Promise<string> {
  const response = await fetch(endpoint('/actuator/prometheus'), { signal, headers: { Accept: 'text/plain' } })
  if (!response.ok) {
    throw new Error(`Prometheus scrape failed with status ${response.status}`)
  }
  return response.text()
}
