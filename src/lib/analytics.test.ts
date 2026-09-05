import { describe, expect, it } from 'vitest'
import { computeTradePnl, effectivePnl, normalizeSetupName, pickBestWorstDay, tradeMultiplier, tradeCostBasis, tradeRoi, calcDrawdown, calcMaxDrawdown, calcKPIs, calcSymbolStats, fmtProfitFactor, filterByDate } from './analytics'
import { forexLotValue } from './contractMultiplier'
import type { TradeRow } from './types'

const stock = (o: Partial<Parameters<typeof effectivePnl>[0]>) => ({
  entry: 0, exit: null as number | null, shares: 0, type: 'Long' as const,
  asset_type: 'stock' as const, symbol: 'X', commission: 0, pnl: 0,
  pnl_is_override: false, ...o,
})

const mkTrade = (o: Partial<TradeRow>): TradeRow => ({
  id: 'x', user_id: 'u', symbol: 'X', type: 'Long', asset_type: 'stock',
  entry: 0, exit: 1, shares: 1, commission: 0, pnl: 0, risk: 0,
  date: '2024-01-01', exit_date: null, setup: null, grade: null, notes: null,
  tags: [], screenshot_urls: [], screenshot_url: null, strategy_id: null,
  account_id: null, trade_group_id: null, created_at: '', updated_at: '',
  pnl_is_override: false,
  ...o,
} as TradeRow)

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
  })
  it('recomputes a stale non-zero stored value that the fills contradict (pre-launch audit: 63/163 real trades were in this state — a bad import, or pnl left behind after commission was corrected)', () => {
    // Old, buggy heuristic ("trust any non-zero stored value") would have
    // kept 250 here. This is the exact PR#32 pattern: a stored value that
    // does NOT carry pnl_is_override must be recomputed from the fills.
    expect(effectivePnl(stock({ entry: 10, exit: 12, shares: 100, pnl: 250 }))).toBe(200)
  })
  it('keeps a genuine manual override (pnl_is_override: true) even though it disagrees with the fills', () => {
    expect(effectivePnl(stock({ entry: 10, exit: 12, shares: 100, pnl: 250, pnl_is_override: true }))).toBe(250)
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

describe('tradeMultiplier', () => {
  it('stock is 1x', () => {
    expect(tradeMultiplier({ asset_type: 'stock', symbol: 'AAPL' })).toBe(1)
  })
  it('option is 100x', () => {
    expect(tradeMultiplier({ asset_type: 'option', symbol: 'AAPL260117C00150000' })).toBe(100)
  })
  it('recognized futures contract uses its point value', () => {
    expect(tradeMultiplier({ asset_type: 'futures', symbol: 'ESH26' })).toBe(50)
  })
  it('unrecognized futures contract is null, not a silent 1x', () => {
    expect(tradeMultiplier({ asset_type: 'futures', symbol: 'ZZZH26' })).toBeNull()
  })
  it('USD-quote forex pair uses the standard-lot value', () => {
    expect(tradeMultiplier({ asset_type: 'forex', symbol: 'EURUSD' })).toBe(100000)
  })
  it('USD-base forex pair (needs live FX conversion) is null, not a silent 1x', () => {
    expect(tradeMultiplier({ asset_type: 'forex', symbol: 'USDJPY' })).toBeNull()
  })
})

describe('tradeCostBasis / tradeRoi (the ~100x options ROI bug)', () => {
  it('stock: cost basis is entry × shares, unscaled', () => {
    expect(tradeCostBasis({ entry: 10, shares: 100, asset_type: 'stock', symbol: 'AAPL' })).toBe(1000)
  })
  it('option: cost basis is scaled by the 100x contract multiplier, same as pnl', () => {
    // 1 contract, $1.00 entry premium -> $100 cost basis, not $1
    expect(tradeCostBasis({ entry: 1, shares: 1, asset_type: 'option', symbol: 'AAPL260117C00150000' })).toBe(100)
  })
  it('option ROI: pnl and cost basis use the same multiplier, so it cancels — no more ~100x inflation', () => {
    // entry 1 -> exit 1.5, 2 contracts: pnl = (1.5-1)*2*100 = 100; cost basis = 1*2*100 = 200; ROI = 50%
    const roi = tradeRoi({ entry: 1, shares: 2, pnl: 100, asset_type: 'option', symbol: 'AAPL260117C00150000' })
    expect(roi).toBeCloseTo(50, 5)
    // Old buggy formula (pnl / (entry*shares)) would have given (100/(1*2))*100 = 5000% — ~100x too high.
    expect(roi).not.toBeCloseTo(5000, 0)
  })
  it('returns null (not 0 or a wrong number) when the multiplier cannot be determined', () => {
    expect(tradeCostBasis({ entry: 1, shares: 1, asset_type: 'futures', symbol: 'ZZZH26' })).toBeNull()
    expect(tradeRoi({ entry: 1, shares: 1, pnl: 5, asset_type: 'futures', symbol: 'ZZZH26' })).toBeNull()
  })
})

describe('forexLotValue', () => {
  it('recognizes USD-quote pairs regardless of separator/case', () => {
    expect(forexLotValue('EURUSD')).toBe(100000)
    expect(forexLotValue('EUR/USD')).toBe(100000)
    expect(forexLotValue('eur-usd')).toBe(100000)
  })
  it('returns null for a USD-base pair (would need live FX conversion)', () => {
    expect(forexLotValue('USDJPY')).toBeNull()
  })
})

describe('fmtProfitFactor', () => {
  it('renders a normal ratio to 2 decimals', () => {
    expect(fmtProfitFactor(1.5)).toBe('1.50')
  })
  it('renders Infinity as the ∞ symbol, not the string "Infinity"', () => {
    expect(fmtProfitFactor(Infinity)).toBe('∞')
  })
  it('renders 0 as "0.00", not ∞', () => {
    expect(fmtProfitFactor(0)).toBe('0.00')
  })
})

describe('calcKPIs profitFactor (wins with zero losses = ∞, not the raw win dollar amount)', () => {
  it('is Infinity when there are wins and no losses', () => {
    const trades = [mkTrade({ pnl: 50 }), mkTrade({ pnl: 30 })]
    expect(calcKPIs(trades).profitFactor).toBe(Infinity)
  })
  it('is 0 when there are no closed trades at all', () => {
    expect(calcKPIs([]).profitFactor).toBe(0)
  })
  it('is a normal ratio when both wins and losses exist', () => {
    const trades = [mkTrade({ pnl: 100 }), mkTrade({ pnl: -50 })]
    expect(calcKPIs(trades).profitFactor).toBe(2)
  })
})

describe('calcSymbolStats (breakeven trades are neither a win nor a loss)', () => {
  it('a breakeven trade (pnl === 0) is not counted as a loss', () => {
    const trades = [
      mkTrade({ symbol: 'AAPL', pnl: 100 }),
      mkTrade({ symbol: 'AAPL', pnl: 0 }),   // breakeven — used to fall into the "loss" bucket
      mkTrade({ symbol: 'AAPL', pnl: -20 }),
    ]
    const [s] = calcSymbolStats(trades)
    expect(s.trades).toBe(3)
    expect(s.wins).toBe(1)
    expect(s.losses).toBe(1)          // NOT 2 — the breakeven doesn't count
    expect(s.grossLoss).toBe(-20)     // the breakeven contributes nothing
  })
})

describe('filterByDate "week" (Monday-start, matching the rest of the app)', () => {
  it('a trade from this Monday is included when "now" is this Sunday', () => {
    // 2024-01-01 is a Monday, 2024-01-07 the following Sunday — same
    // Monday-start week. With date-fns' Sunday-start default this trade
    // would have been excluded (Sunday starts a NEW week under that rule).
    const now = new Date('2024-01-07T18:00:00')
    const trades = [mkTrade({ date: '2024-01-01T09:00:00' })]
    expect(filterByDate(trades, { range: 'week' }, now)).toHaveLength(1)
  })
  it('a trade from the PRIOR Monday-start week is excluded when "now" is this Sunday', () => {
    const now = new Date('2024-01-07T18:00:00')
    const trades = [mkTrade({ date: '2023-12-31T09:00:00' })] // the prior week's Sunday
    expect(filterByDate(trades, { range: 'week' }, now)).toHaveLength(0)
  })
})

describe('calcDrawdown / calcMaxDrawdown (trade-level, not day-level)', () => {
  const t = mkTrade

  it('a single intraday dip inside a net-positive day is NOT hidden (the day-level aggregation bug)', () => {
    // +1000, -1800, +900 all on the same day nets +100 for the day, but the
    // real running equity dipped to -800 from its peak of +1000 at one point.
    const trades = [
      t({ date: '2024-01-01T09:00:00Z', pnl: 1000 }),
      t({ date: '2024-01-01T10:00:00Z', pnl: -1800 }),
      t({ date: '2024-01-01T11:00:00Z', pnl: 900 }),
    ]
    expect(calcMaxDrawdown(trades)).toBeCloseTo(1800, 2)
  })
  it('drawdown is 0 when equity only ever climbs', () => {
    const trades = [
      t({ date: '2024-01-01', pnl: 100 }),
      t({ date: '2024-01-02', pnl: 50 }),
    ]
    expect(calcMaxDrawdown(trades)).toBe(0)
  })
  it('open trades (no exit) are excluded from the walk', () => {
    // If the open trade's -9999 were wrongly included, this would show a huge
    // drawdown. Excluded correctly, equity only climbs (500, then 600) -> 0.
    const trades = [
      t({ date: '2024-01-01', pnl: 500 }),
      t({ date: '2024-01-02', pnl: -9999, exit: null }), // open — excluded
      t({ date: '2024-01-03', pnl: 100 }),
    ]
    expect(calcMaxDrawdown(trades)).toBe(0)
  })
  it('calcDrawdown labels/data stay in chronological order regardless of input order', () => {
    const trades = [
      t({ date: '2024-01-03', pnl: 100 }),
      t({ date: '2024-01-01', pnl: 500 }),
      t({ date: '2024-01-02', pnl: -200 }),
    ]
    const { data } = calcDrawdown(trades)
    expect(data).toHaveLength(3)
    expect(data[1]).toBeCloseTo(-200, 2) // after the -200 leg, running=300, peak=500
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
