import { describe, expect, it } from 'vitest'
import { computeCommission, isWithinAbsoluteWindow, isWithinCommissionWindow } from './commission'

describe('isWithinCommissionWindow', () => {
  it('is true on the exact boundary (N months later, same day)', () => {
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 6, '2026-07-15T00:00:00.000Z')).toBe(true)
  })
  it('is true well within the window', () => {
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 6, '2026-03-01T00:00:00.000Z')).toBe(true)
  })
  it('is false one day past the boundary', () => {
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 6, '2026-07-16T00:00:00.000Z')).toBe(false)
  })
  it('handles a 12-month partner window', () => {
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 12, '2027-01-15T00:00:00.000Z')).toBe(true)
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 12, '2027-01-16T00:00:00.000Z')).toBe(false)
  })
})

describe('computeCommission', () => {
  it('computes 20% of the gross amount, rounded to cents', () => {
    expect(computeCommission(2900, 0.20)).toEqual({ grossUsd: 29, commissionUsd: 5.8 })
  })
  it('computes a non-20% rate correctly', () => {
    expect(computeCommission(999, 0.15)).toEqual({ grossUsd: 9.99, commissionUsd: 1.5 })
  })
  it('rounds to the nearest cent rather than truncating', () => {
    // 33.33 cents of gross at 20% = 6.666 -> rounds to 6.67, not 6.66
    expect(computeCommission(3333, 0.20)).toEqual({ grossUsd: 33.33, commissionUsd: 6.67 })
  })
  it('returns null for zero or negative amounts', () => {
    expect(computeCommission(0, 0.20)).toBeNull()
    expect(computeCommission(-500, 0.20)).toBeNull()
  })
})

describe('isWithinAbsoluteWindow', () => {
  it('is true when now falls inside the window', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2026-06-15T00:00:00.000Z')).toBe(true)
  })
  it('is true on the exact start boundary (inclusive)', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(true)
  })
  it('is true on the exact end boundary (inclusive)', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2026-12-31T00:00:00.000Z')).toBe(true)
  })
  it('is false before the window starts', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2025-12-31T23:59:59.999Z')).toBe(false)
  })
  it('is false after the window ends', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2027-01-01T00:00:00.000Z')).toBe(false)
  })
  it('is false when either or both bounds are null', () => {
    expect(isWithinAbsoluteWindow(null, '2026-12-31T00:00:00.000Z', '2026-06-15T00:00:00.000Z')).toBe(false)
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', null, '2026-06-15T00:00:00.000Z')).toBe(false)
    expect(isWithinAbsoluteWindow(null, null, '2026-06-15T00:00:00.000Z')).toBe(false)
  })
})
