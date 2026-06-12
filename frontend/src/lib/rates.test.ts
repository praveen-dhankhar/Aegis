import { describe, expect, it } from 'vitest'
import { counterRate, ratio } from './rates'

describe('counterRate', () => {
  it('calculates positive counter rates', () => {
    expect(counterRate({ value: 10, sampledAt: 0 }, { value: 25, sampledAt: 3000 })).toBe(5)
  })

  it('handles resets and invalid initial samples', () => {
    expect(counterRate({ value: 25, sampledAt: 0 }, { value: 10, sampledAt: 3000 })).toBe(0)
    expect(counterRate(null, { value: 10, sampledAt: 3000 })).toBeNull()
  })
})

describe('ratio', () => {
  it('avoids divide by zero', () => {
    expect(ratio(1, 0)).toBeNull()
    expect(ratio(1, 4)).toBe(0.25)
  })
})
