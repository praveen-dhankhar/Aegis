export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) {
    return 'Unavailable'
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return 'Unavailable'
  }
  return `${formatNumber(value * 100, 1)}%`
}

export function formatMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return 'Unavailable'
  }
  return `${formatNumber(value, 2)} ms`
}

export function formatWindow(ms: number): string {
  if (ms % 60000 === 0) {
    return `${ms / 60000}m`
  }
  if (ms % 1000 === 0) {
    return `${ms / 1000}s`
  }
  return `${ms}ms`
}
