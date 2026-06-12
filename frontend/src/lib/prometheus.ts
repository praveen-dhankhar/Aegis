export interface MetricSample {
  name: string
  labels: Record<string, string>
  value: number
  timestamp?: number
}

function parseLabels(raw: string): Record<string, string> {
  const labels: Record<string, string> = {}
  let index = 0
  while (index < raw.length) {
    const keyMatch = /^[A-Za-z_][A-Za-z0-9_]*=/.exec(raw.slice(index))
    if (!keyMatch) {
      break
    }
    const key = keyMatch[0].slice(0, -1)
    index += keyMatch[0].length
    if (raw[index] !== '"') {
      break
    }
    index += 1
    let value = ''
    while (index < raw.length) {
      const char = raw[index]
      if (char === '\\') {
        const next = raw[index + 1]
        value += next === 'n' ? '\n' : next === undefined ? '' : next
        index += 2
        continue
      }
      if (char === '"') {
        index += 1
        break
      }
      value += char
      index += 1
    }
    labels[key] = value
    if (raw[index] === ',') {
      index += 1
    }
  }
  return labels
}

export function parsePromText(raw: string): MetricSample[] {
  const samples: MetricSample[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const match = /^(?<name>[A-Za-z_:][A-Za-z0-9_:]*)(?:\{(?<labels>.*)\})?\s+(?<value>[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|NaN|\+Inf|-Inf)(?:\s+(?<timestamp>\d+))?$/.exec(trimmed)
    if (!match?.groups) {
      continue
    }
    const value = Number(match.groups.value.replace('+Inf', 'Infinity').replace('-Inf', '-Infinity'))
    samples.push({
      name: match.groups.name,
      labels: match.groups.labels ? parseLabels(match.groups.labels) : {},
      value,
      timestamp: match.groups.timestamp ? Number(match.groups.timestamp) : undefined,
    })
  }
  return samples
}

export function sumSamples(samples: MetricSample[], name: string, labels: Record<string, string> = {}): number | null {
  const matching = samples.filter((sample) => {
    if (sample.name !== name || !Number.isFinite(sample.value)) {
      return false
    }
    return Object.entries(labels).every(([key, value]) => sample.labels[key] === value)
  })
  if (matching.length === 0) {
    return null
  }
  return matching.reduce((total, sample) => total + sample.value, 0)
}
