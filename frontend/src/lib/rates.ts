export interface CounterSnapshot {
  value: number | null
  sampledAt: number
}

export function counterRate(previous: CounterSnapshot | null, current: CounterSnapshot): number | null {
  if (previous == null || previous.value == null || current.value == null) {
    return null
  }
  if (!Number.isFinite(previous.value) || !Number.isFinite(current.value)) {
    return null
  }
  const elapsedSeconds = (current.sampledAt - previous.sampledAt) / 1000
  if (elapsedSeconds <= 0 || !Number.isFinite(elapsedSeconds)) {
    return null
  }
  const delta = Math.max(0, current.value - previous.value)
  return delta / elapsedSeconds
}

export function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) {
    return null
  }
  return numerator / denominator
}
