import { describe, expect, it } from 'vitest'
import { computeTradePnl, effectivePnl, normalizeSetupName, pickBestWorstDay } from './analytics'

const stock = (o: Partial<Parameters<typeof effectivePnl>[0]>) => ({
  entry: 0, exit: null as number | null, shares: 0, type: 'Long' as const,
  asset_type: 'stock' as const, symbol: 'X', commission: 0, pnl: 0, ...o,
})

describe('computeTradePnl', () => {
  it('Long, exit below entry, is a loss', () => {
    // ESTC: 94.44 -> 93.19, 69 shares
    expect(computeTradePnl(stock({ entry: 94.44, exit: 93.19, shares: 69 }))).toBeCloseTo(-86.25, 2)
  })
  it('Long win, and subtracts commission', () => {
    expect(computeTradePnl(stock({ entry: 10, exit: 12, shares: 100, commission: 5 }))).toBe(195)
  })
  it('Short: profit when exit is below entry', () => {
    expect(computeTradePnl(stock({ entry: 12, exit: 10, shares: 100, type: 'Short' }))).toBe(200)
  })
  it('options apply the 100x multiplier', () => {
    expect(computeTradePnl(stock({ entry: 1, exit: 1.5, shares: 2, asset_type: 'option' }))).toBe(100)
  })
  it('null when a fill price or size is missing', () => {
    expect(computeTradePnl(stock({ entry: 94.44, exit: null, shares: 69 }))).toBeNull()
    expect(computeTradePnl(stock({ entry: 94.44, exit: 93.19, shares: 0 }))).toBeNull()
  })
})

describe('effectivePnl', () => {
  it('recomputes a stored 0 that the fills contradict (the ESTC bug)', () => {
    expect(effectivePnl(stock({ entry: 94.44, exit: 93.19, shares: 69, pnl: 0 }))).toBeCloseTo(-86.25, 2)
  })
  it('leaves a correct non-zero stored value alone', () => {
    expect(effectivePnl(stock({ entry: 94.44, exit: 93.19, shares: 69, pnl: -86.25 }))).toBe(-86.25)
    expect(effectivePnl(stock({ entry: 10, exit: 12, shares: 100, pnl: 250 }))).toBe(250) // manual override kept
  })
  it('keeps a true breakeven (exit === entry) at 0', () => {
    expect(effectivePnl(stock({ entry: 50, exit: 50, shares: 100, pnl: 0 }))).toBe(0)
  })
  it('leaves an open trade (no exit) untouched', () => {
    expect(effectivePnl(stock({ entry: 94.44, exit: null, shares: 69, pnl: 0 }))).toBe(0)
  })
})

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
