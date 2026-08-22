import { describe, expect, it } from 'vitest'
import { computeCommission, isWithinAbsoluteWindow, isWithinCommissionWindow, bucketMonthlyCommissions } from './commission'

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

describe('bucketMonthlyCommissions', () => {
  it('returns an empty array for no rows', () => {
    expect(bucketMonthlyCommissions([])).toEqual([])
  })
  it('buckets a single row into its month', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-03-15T10:00:00.000Z', commission_amount: 12.5 },
    ])).toEqual([{ month: '2026-03', commission: 12.5 }])
  })
  it('sums multiple rows in the same month', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-03-01T00:00:00.000Z', commission_amount: 10 },
      { created_at: '2026-03-28T23:59:59.000Z', commission_amount: 5 },
    ])).toEqual([{ month: '2026-03', commission: 15 }])
  })
  it('sorts months ascending regardless of input order', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-05-01T00:00:00.000Z', commission_amount: 1 },
      { created_at: '2026-01-01T00:00:00.000Z', commission_amount: 2 },
      { created_at: '2026-03-01T00:00:00.000Z', commission_amount: 3 },
    ])).toEqual([
      { month: '2026-01', commission: 2 },
      { month: '2026-03', commission: 3 },
      { month: '2026-05', commission: 1 },
    ])
  })
  it('nets a same-month reversal against its original', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-06-01T00:00:00.000Z', commission_amount: 20 },
      { created_at: '2026-06-10T00:00:00.000Z', commission_amount: -20 },
    ])).toEqual([{ month: '2026-06', commission: 0 }])
  })
  it('rounds to the nearest cent', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-07-01T00:00:00.000Z', commission_amount: 1.111 },
      { created_at: '2026-07-02T00:00:00.000Z', commission_amount: 1.111 },
    ])).toEqual([{ month: '2026-07', commission: 2.22 }])
  })
  it('buckets by UTC month, not local time, for timestamps with a non-UTC offset', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-02-28T23:00:00-05:00', commission_amount: 5 }, // = 2026-03-01T04:00:00Z
      { created_at: '2026-03-01T00:30:00+02:00', commission_amount: 7 }, // = 2026-02-28T22:30:00Z
    ])).toEqual([
      { month: '2026-02', commission: 7 },
      { month: '2026-03', commission: 5 },
    ])
  })
})
