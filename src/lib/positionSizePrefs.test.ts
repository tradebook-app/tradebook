import { describe, expect, it } from 'vitest'
import {
  normalizePositionSizePrefs,
  POSITION_SIZE_DEFAULTS,
  STOCK_DEFAULTS,
  FUTURES_DEFAULTS,
} from './positionSizePrefs'

describe('defaults', () => {
  it('are the empty/blank starting state', () => {
    expect(STOCK_DEFAULTS).toEqual({ account: '', riskPct: '', maxPct: '', side: 'Long' })
    expect(FUTURES_DEFAULTS).toEqual({
      futAccount: '', futRiskMode: 'pct', futRiskInput: '', futSymbol: 'ES', futStopUnit: 'points',
    })
    expect(POSITION_SIZE_DEFAULTS.mode).toBe('stocks')
  })
})

describe('normalizePositionSizePrefs', () => {
  it('returns defaults for junk input', () => {
    for (const junk of [null, undefined, 0, '', 'nope', [], true]) {
      expect(normalizePositionSizePrefs(junk)).toEqual(POSITION_SIZE_DEFAULTS)
    }
  })

  it('returns defaults for an empty object', () => {
    expect(normalizePositionSizePrefs({})).toEqual(POSITION_SIZE_DEFAULTS)
  })

  it('round-trips a full valid blob', () => {
    const full = {
      mode: 'futures',
      stocks: { account: '50000', riskPct: '2', maxPct: '30', side: 'Short' },
      futures: { futAccount: '25000', futRiskMode: 'fixed', futRiskInput: '250', futSymbol: 'NQ', futStopUnit: 'ticks' },
    }
    expect(normalizePositionSizePrefs(full)).toEqual(full)
  })

  it('fills only the missing fields from a partial blob', () => {
    const out = normalizePositionSizePrefs({ stocks: { account: '10000' } })
    expect(out.stocks).toEqual({ account: '10000', riskPct: '', maxPct: '', side: 'Long' })
    expect(out.futures).toEqual(FUTURES_DEFAULTS)
    expect(out.mode).toBe('stocks')
  })

  it('rejects unrecognised enum values back to their default', () => {
    const out = normalizePositionSizePrefs({
      mode: 'crypto',
      stocks: { side: 'sideways' },
      futures: { futRiskMode: 'martingale', futStopUnit: 'furlongs' },
    })
    expect(out.mode).toBe('stocks')
    expect(out.stocks.side).toBe('Long')
    expect(out.futures.futRiskMode).toBe('pct')
    expect(out.futures.futStopUnit).toBe('points')
  })

  it('coerces stored numbers to strings and drops other types', () => {
    const out = normalizePositionSizePrefs({
      stocks: { account: 50000, riskPct: null, maxPct: { bad: 1 } },
      futures: { futAccount: 25000.5 },
    })
    expect(out.stocks.account).toBe('50000')
    expect(out.stocks.riskPct).toBe('')
    expect(out.stocks.maxPct).toBe('')
    expect(out.futures.futAccount).toBe('25000.5')
  })

  it('falls back to ES when the stored futures symbol is blank/invalid', () => {
    expect(normalizePositionSizePrefs({ futures: { futSymbol: '' } }).futures.futSymbol).toBe('ES')
    expect(normalizePositionSizePrefs({ futures: { futSymbol: 42 } }).futures.futSymbol).toBe('42')
  })

  it('tolerates stocks/futures being wrong-typed', () => {
    expect(normalizePositionSizePrefs({ stocks: 'x', futures: [] })).toEqual(POSITION_SIZE_DEFAULTS)
  })
})
