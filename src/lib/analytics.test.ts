import { describe, expect, it } from 'vitest'
import { normalizeSetupName, pickBestWorstDay } from './analytics'

describe('normalizeSetupName', () => {
  it('folds case so "Bull Flag" and "bull flag" match', () => {
    expect(normalizeSetupName('Bull Flag')).toBe(normalizeSetupName('bull flag'))
    expect(normalizeSetupName('BULL FLAG')).toBe('bull flag')
  })

  it('folds leading/trailing and repeated internal whitespace', () => {
    expect(normalizeSetupName('  Bull   Flag  ')).toBe('bull flag')
    expect(normalizeSetupName('Bull\tFlag')).toBe('bull flag')
  })

  it('returns "" for null / undefined / empty', () => {
    expect(normalizeSetupName(null)).toBe('')
    expect(normalizeSetupName(undefined)).toBe('')
    expect(normalizeSetupName('   ')).toBe('')
  })

  it('groups a mixed list of casing variants into one key', () => {
    const trades = [
      { setup: 'Bull Flag' },
      { setup: 'bull flag' },
      { setup: 'Bull  Flag' },
      { setup: 'ORB' },
    ]
    const keys = new Set(trades.map(t => normalizeSetupName(t.setup)))
    expect(keys).toEqual(new Set(['bull flag', 'orb']))
  })
})

describe('pickBestWorstDay', () => {
  it('returns nulls for an empty list', () => {
    expect(pickBestWorstDay([])).toEqual({ best: null, worst: null })
  })

  it('with a single traded day, worst is null (does not echo best)', () => {
    const only = { pnl: 23200 }
    const r = pickBestWorstDay([only])
    expect(r.best).toBe(only)
    expect(r.worst).toBeNull()
  })

  it('with multiple days, best is the highest and worst the lowest', () => {
    const a = { pnl: 500 }
    const b = { pnl: -1200 }
    const c = { pnl: 80 }
    const r = pickBestWorstDay([a, b, c])
    expect(r.best).toBe(a)
    expect(r.worst).toBe(b)
  })

  it('all-green days: worst is the smallest gain, still shown', () => {
    const big = { pnl: 4000 }
    const small = { pnl: 120 }
    const r = pickBestWorstDay([big, small])
    expect(r.best).toBe(big)
    expect(r.worst).toBe(small)
  })
})
