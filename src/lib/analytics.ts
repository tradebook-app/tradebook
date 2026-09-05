import { TradeRow, DateRangeFilter, KPIData, DayStats, SymbolStats, StrategyStats } from '@/lib/types'
import { format, startOfWeek, startOfMonth, startOfYear, isToday } from 'date-fns'
import { OPTION_MULTIPLIER, futuresPointValue, forexLotValue } from '@/lib/contractMultiplier'

// ─── Trade P&L ───────────────────────────────────────────────────────────────
// `pnl` is a stored column, but some rows carry a wrong 0 — a bad broker
// import, or an edit that re-saved a stale P&L "override" (see AddTradeModal).
// These helpers recompute from the fill prices so the number, and everything
// derived from it (Status, KPIs, charts), stays correct.

type PnlFields = Pick<TradeRow, 'entry' | 'exit' | 'shares' | 'type' | 'asset_type' | 'symbol' | 'commission'>
type MultFields = Pick<TradeRow, 'asset_type' | 'symbol'>

// $ per point/share for one unit of `shares` — the single place that decides
// this, so P&L and anything derived FROM P&L (cost basis, ROI %) always agree
// on it. null when it can't be determined (an unrecognized futures contract
// or forex pair) rather than silently assuming 1.
export function tradeMultiplier(t: MultFields): number | null {
  if (t.asset_type === 'option') return OPTION_MULTIPLIER
  if (t.asset_type === 'futures') return futuresPointValue(t.symbol || '')
  if (t.asset_type === 'forex') return forexLotValue(t.symbol || '')
  return 1
}

// P&L implied by the fills. null when the trade lacks entry / exit / shares, or
// when the multiplier can't be determined (see tradeMultiplier).
export function computeTradePnl(t: PnlFields): number | null {
  if (!t.entry || !t.exit || !t.shares) return null
  const mult = tradeMultiplier(t)
  if (mult == null) return null
  const gross = (t.exit - t.entry) * t.shares * mult * (t.type === 'Short' ? -1 : 1)
  return Number((gross - (t.commission || 0)).toFixed(2))
}

// Dollar cost basis of the position (entry price × size × the SAME multiplier
// P&L uses) — the correct ROI % denominator. Before this, every ROI% display
// divided a multiplier-scaled P&L by an un-multiplied entry×shares, inflating
// options ROI by ~100× (and futures ROI by whatever the contract's point
// value is). null when the multiplier can't be determined.
export function tradeCostBasis(t: Pick<TradeRow, 'entry' | 'shares'> & MultFields): number | null {
  if (!t.entry || !t.shares) return null
  const mult = tradeMultiplier(t)
  return mult == null ? null : t.entry * t.shares * mult
}

// ROI % for a single trade — pnl ÷ cost basis, both scaled by the same
// multiplier. null when the cost basis can't be determined (show '—', not a
// wrong number).
export function tradeRoi(t: Pick<TradeRow, 'entry' | 'shares' | 'pnl'> & MultFields): number | null {
  const basis = tradeCostBasis(t)
  return basis && basis > 0 ? (t.pnl / basis) * 100 : null
}

// The P&L to actually use. A live-database audit found 63/163 real trades
// where the stored pnl simply didn't match entry/exit/shares/commission (a
// bad import, or a stored value left behind after commission was corrected
// without recomputing pnl) — the old rule here ("trust any non-zero stored
// value") never caught those, only a stored exact 0. Now: trust the stored
// value ONLY when the user deliberately overrode it (pnl_is_override, set by
// AddTradeModal's P&L Override field) or when there's nothing to recompute
// from (missing fills, or an unrecognized futures contract). Everything else
// — including a genuine entry===exit breakeven, which still owes commission —
// is recomputed from the fills, which is what actually happened.
export function effectivePnl(t: PnlFields & { pnl: number; pnl_is_override?: boolean }): number {
  if (t.pnl_is_override) return t.pnl
  const computed = computeTradePnl(t)
  return computed == null ? t.pnl : computed
}

// ─── Date filtering ──────────────────────────────────────────────────────────

export function filterByDate(trades: TradeRow[], filter: DateRangeFilter, now: Date = new Date()): TradeRow[] {
  if (filter.range === 'all') return trades

  if (filter.range === 'today') {
    return trades.filter(t => isToday(new Date(t.date)))
  }
  if (filter.range === 'week') {
    // weekStartsOn: 1 (Monday) — date-fns defaults to Sunday, but every other
    // week-boundary calculation in this app (calendar's DOW columns,
    // OverviewReport's weekKey grouping) already assumes Monday-start. Left
    // at the default, this filter and the rest of the app would disagree
    // about which trades fall in "this week" for the first ~24-48h of it.
    const start = startOfWeek(now, { weekStartsOn: 1 })
    return trades.filter(t => new Date(t.date) >= start)
  }
  if (filter.range === 'month') {
    const start = startOfMonth(now)
    return trades.filter(t => new Date(t.date) >= start)
  }
  if (filter.range === 'year') {
    const start = startOfYear(now)
    return trades.filter(t => new Date(t.date) >= start)
  }
  if (filter.range === 'custom') {
    const from = filter.from
    const to   = filter.to
    return trades.filter(t => {
      const ds = t.date.substring(0, 10)
      return (!from || ds >= from) && (!to || ds <= to)
    })
  }
  return trades
}

// ─── Closed trades only ──────────────────────────────────────────────────────

export function closedTrades(trades: TradeRow[]): TradeRow[] {
  return trades.filter(t => t.exit && t.exit > 0)
}

export function openTrades(trades: TradeRow[]): TradeRow[] {
  return trades.filter(t => !t.exit || t.exit === 0)
}

// ─── KPI calculation ─────────────────────────────────────────────────────────

export function calcKPIs(trades: TradeRow[]): KPIData {
  const closed = closedTrades(trades)
  const wins   = closed.filter(t => t.pnl > 0)
  const losses = closed.filter(t => t.pnl < 0)
  const be     = closed.filter(t => t.pnl === 0)

  const netPnl = closed.reduce((s, t) => s + t.pnl, 0)
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0

  const avgWin = wins.length
    ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length
    : 0
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)
    : 0

  const grossWin  = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))

  // Profit factor is gross win ÷ gross loss — a RATIO. With wins and zero
  // losses that ratio is mathematically infinite ("∞"), not the raw dollar
  // amount of the wins (what this used to return) — a $50 winner with no
  // losses was displaying as a profit factor of "50.00", not "∞". Use the
  // real JS Infinity value; fmtProfitFactor() renders it as '∞'.
  const profitFactor = grossLoss > 0
    ? grossWin / grossLoss
    : grossWin > 0
      ? Infinity
      : 0

  const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0

  return {
    netPnl,
    winRate,
    profitFactor,
    avgWinLossRatio,
    avgWin,
    avgLoss,
    wins: wins.length,
    losses: losses.length,
    breakeven: be.length,
    totalTrades: closed.length,
  }
}

// ─── Daily P&L ───────────────────────────────────────────────────────────────

export function calcDailyPnl(trades: TradeRow[]): DayStats[] {
  const byDay: Record<string, DayStats> = {}

  closedTrades(trades).forEach(t => {
    const ds = t.date.substring(0, 10)
    if (!byDay[ds]) byDay[ds] = { date: ds, pnl: 0, trades: 0, wins: 0 }
    byDay[ds].pnl    += t.pnl
    byDay[ds].trades += 1
    if (t.pnl > 0) byDay[ds].wins += 1
  })

  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Cumulative P&L ──────────────────────────────────────────────────────────

export function calcCumulative(trades: TradeRow[]): { labels: string[]; data: number[] } {
  const closed = closedTrades(trades)
  // Aggregate by day so a day with many trades is ONE point (a true daily cumulative)
  const byDay: Record<string, number> = {}
  closed.forEach(t => {
    const d = (t.date || '').substring(0, 10)
    byDay[d] = (byDay[d] || 0) + t.pnl
  })
  const days = Object.keys(byDay).sort()
  let running = 0
  const labels: string[] = []
  const data: number[]   = []

  days.forEach(d => {
    running += byDay[d]
    labels.push(format(new Date(`${d}T12:00:00`), 'MMM d'))
    data.push(parseFloat(running.toFixed(2)))
  })

  return { labels, data }
}

// ─── Drawdown ────────────────────────────────────────────────────────────────
// Trade-level, not day-level: aggregating P&L by day first (the old approach)
// hides real intraday equity dips whenever a day nets positive overall — e.g.
// +$1000, -$1800, +$900 in one day nets +$100 and would show $0 drawdown, even
// though the account was really down $1800 at one point. Walking the running
// peak trade-by-trade is the single shared source both the Dashboard chart and
// Reports > Overview's "Max drawdown" stat use, so they can't disagree again.

export function calcDrawdown(trades: TradeRow[]): { labels: string[]; data: number[] } {
  const closed = closedTrades(trades).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  let running = 0, peak = 0
  const labels: string[] = []
  const data: number[]   = []

  closed.forEach(t => {
    running += t.pnl
    if (running > peak) peak = running
    labels.push(fmtLabel(t.date))
    data.push(parseFloat((-(peak - running)).toFixed(2)))
  })

  return { labels, data }
}

// Max drawdown as a single positive dollar figure (0 when there's none yet).
// Math.abs (not unary -) so an all-climbing equity curve returns +0 rather
// than -0 — both are numerically "no drawdown", but -0 fails strict-equality
// checks and is worth avoiding as a returned value.
export function calcMaxDrawdown(trades: TradeRow[]): number {
  const { data } = calcDrawdown(trades)
  return data.length ? Math.abs(Math.min(...data)) : 0
}

// ─── Symbol stats ────────────────────────────────────────────────────────────

export function calcSymbolStats(trades: TradeRow[]): SymbolStats[] {
  const map: Record<string, SymbolStats> = {}

  closedTrades(trades).forEach(t => {
    if (!map[t.symbol]) {
      map[t.symbol] = { symbol: t.symbol, pnl: 0, trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0 }
    }
    const s = map[t.symbol]
    s.pnl    += t.pnl
    s.trades += 1
    // A breakeven trade (pnl === 0) is neither a win nor a loss — it used to
    // fall into the `else` branch here and get counted as a loss (harmless
    // to grossLoss, since it adds 0, but Losses = trades - wins in the UI
    // then wrongly included it, and diluted win rate as if it were a loss).
    if (t.pnl > 0)      { s.wins += 1; s.grossWin  += t.pnl }
    else if (t.pnl < 0) { s.losses += 1; s.grossLoss += t.pnl }
  })

  return Object.values(map).sort((a, b) => b.pnl - a.pnl)
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

// Profit factor is a ratio (gross win ÷ gross loss); with wins and zero
// losses it's mathematically infinite. Every profitFactor/pf value in this
// app should be formatted through this, not a raw .toFixed(2) — Infinity
// itself formats to the literal string "Infinity" via toFixed.
export function fmtProfitFactor(pf: number): string {
  return pf === Infinity ? '∞' : pf.toFixed(2)
}

export function fmtPnl(n: number, compact = false): string {
  const abs = Math.abs(n)
  const sign = n >= 0 ? '+' : '-'
  if (compact) {
    return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${sign}$${abs.toFixed(2)}`
}

export function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return format(new Date(dateStr), 'MMM d, yyyy')
}

export function fmtLabel(dateStr: string): string {
  return format(new Date(dateStr.substring(0, 10) + 'T12:00:00'), 'MMM d')
}

export function tradeStatus(pnl: number): 'win' | 'loss' | 'be' {
  if (pnl > 0) return 'win'
  if (pnl < 0) return 'loss'
  return 'be'
}

export function holdTime(entryDate: string, exitDate?: string | null): string {
  if (!exitDate) return 'Open'
  const ms = Math.max(0, new Date(exitDate).getTime() - new Date(entryDate).getTime())
  if (ms === 0) return 'Intraday'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = ms / 3600000
  if (hrs < 24) return `${hrs.toFixed(1)}h`
  const days = ms / 86400000
  return days < 2
    ? `1d ${Math.round((ms % 86400000) / 3600000)}h`
    : `${days.toFixed(1)} days`
}

// ─── Setup name normalization ────────────────────────────────────────────────
// Setup names are free text (manual entry, CSV imports, legacy trades), so the
// same setup shows up as "Bull Flag", "bull flag", "Bull  Flag", " Bull Flag ".
// Collapse case and whitespace so those all group as one setup.

export function normalizeSetupName(setup: string | null | undefined): string {
  return (setup || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// ─── Strategy stats ──────────────────────────────────────────────────────────
// A trade belongs to a strategy if it's tagged with strategy_id, OR — for
// trades logged before strategies had real linking — its free-text `setup`
// matches the strategy name. This keeps stats accurate for historical trades
// without requiring a backfill to run perfectly.

export function tradesForStrategy(trades: TradeRow[], strategy: { id: string; name: string }): TradeRow[] {
  const nameKey = normalizeSetupName(strategy.name)
  return trades.filter(t =>
    t.strategy_id === strategy.id ||
    (!t.strategy_id && normalizeSetupName(t.setup) === nameKey)
  )
}

// ─── Best / worst trading day ────────────────────────────────────────────────
// `worst` is null when it would just repeat `best` — i.e. there is only one
// traded day, so showing the same figure under both labels reads as a bug.

export function pickBestWorstDay<T extends { pnl: number }>(days: T[]): { best: T | null; worst: T | null } {
  if (days.length === 0) return { best: null, worst: null }
  const best = days.reduce((a, b) => (b.pnl > a.pnl ? b : a))
  if (days.length < 2) return { best, worst: null }
  const worst = days.reduce((a, b) => (b.pnl < a.pnl ? b : a))
  return { best, worst }
}

export function calcStrategyStats(trades: TradeRow[], strategy: { id: string; name: string }): StrategyStats {
  const closed = closedTrades(tradesForStrategy(trades, strategy))
  const wins   = closed.filter(t => t.pnl > 0)
  const losses = closed.filter(t => t.pnl < 0)

  const netPnl    = closed.reduce((s, t) => s + t.pnl, 0)
  const grossWin  = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))

  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
  // See calcKPIs' profitFactor comment — this returned the raw gross-win
  // dollar amount instead of ∞ when there were no losses to divide by.
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0)
  const avgWin  = wins.length ? grossWin / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0

  return {
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    profitFactor,
    netPnl,
    grossWin,
    grossLoss,
    avgWin,
    avgLoss,
  }
}
