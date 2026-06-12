import { describe, expect, it } from 'vitest'
import { parsePromText, sumSamples } from './prometheus'

describe('parsePromText', () => {
  it('parses metric names labels values and timestamps', () => {
    const samples = parsePromText(String.raw`rate_limit_requests_total{client="a\"b",result="allowed"} 42 1234`)
    expect(samples).toEqual([{ name: 'rate_limit_requests_total', labels: { client: 'a"b', result: 'allowed' }, value: 42, timestamp: 1234 }])
  })

  it('ignores comments and unknown malformed lines', () => {
    const samples = parsePromText('# HELP x\n\nnot valid\nrate_limit_redis_errors_total 3')
    expect(samples).toHaveLength(1)
    expect(sumSamples(samples, 'rate_limit_redis_errors_total')).toBe(3)
  })
})
