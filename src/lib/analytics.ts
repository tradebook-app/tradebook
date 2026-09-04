import { TradeRow, DateRange, DateRangeFilter, KPIData, DayStats, SymbolStats, StrategyStats } from '@/lib/types'
import { format, startOfWeek, startOfMonth, startOfYear, isToday } from 'date-fns'
import { OPTION_MULTIPLIER, futuresPointValue } from '@/lib/contractMultiplier'

// ─── Trade P&L ───────────────────────────────────────────────────────────────
// `pnl` is a stored column, but some rows carry a wrong 0 — a bad broker
// import, or an edit that re-saved a stale P&L "override" (see AddTradeModal).
// These helpers recompute from the fill prices so the number, and everything
// derived from it (Status, KPIs, charts), stays correct.

type PnlFields = Pick<TradeRow, 'entry' | 'exit' | 'shares' | 'type' | 'asset_type' | 'symbol' | 'commission'>

// P&L implied by the fills. null when the trade lacks entry / exit / shares, or
// when it's a futures contract whose point value we don't know.
export function computeTradePnl(t: PnlFields): number | null {
  if (!t.entry || !t.exit || !t.shares) return null
  let mult = 1
  if (t.asset_type === 'option') mult = OPTION_MULTIPLIER
  else if (t.asset_type === 'futures') {
    const pv = futuresPointValue(t.symbol || '')
    if (pv == null) return null
    mult = pv
  }
  const gross = (t.exit - t.entry) * t.shares * mult * (t.type === 'Short' ? -1 : 1)
  return Number((gross - (t.commission || 0)).toFixed(2))
}

// The P&L to actually use. Trusts a non-zero stored value and a genuine
// entry===exit breakeven; only a stored 0 with a real price spread gets
// recomputed (that combination is impossible for a real fill).
export function effectivePnl(t: PnlFields & { pnl: number }): number {
  if (t.pnl !== 0) return t.pnl
  if (t.exit != null && t.entry != null && t.exit === t.entry) return t.pnl
  const computed = computeTradePnl(t)
  return computed == null ? t.pnl : computed
}

// ─── Date filtering ──────────────────────────────────────────────────────────

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: 'All Dates', today: 'Today', week: 'This Week',
  month: 'This Month', year: 'This Year', custom: 'Custom Range',
}

// Human label for the active date filter — matches the DateRangePicker button.
export function dateRangeLabel(filter: DateRangeFilter): string {
  return filter.range === 'custom' && filter.from && filter.to
    ? `${filter.from} → ${filter.to}`
    : DATE_RANGE_LABELS[filter.range]
}

export function filterByDate(trades: TradeRow[], filter: DateRangeFilter): TradeRow[] {
  if (filter.range === 'all') return trades

  const now = new Date()

  if (filter.range === 'today') {
    return trades.filter(t => isToday(new Date(t.date)))
  }
  if (filter.range === 'week') {
    const start = startOfWeek(now)
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

  const profitFactor = grossLoss > 0
    ? grossWin / grossLoss
    : grossWin > 0
      ? grossWin
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

export function calcDrawdown(trades: TradeRow[]): { labels: string[]; data: number[] } {
  const closed = closedTrades(trades)
  const byDay: Record<string, number> = {}
  closed.forEach(t => {
    const d = (t.date || '').substring(0, 10)
    byDay[d] = (byDay[d] || 0) + t.pnl
  })
  const days = Object.keys(byDay).sort()
  let running = 0, peak = 0
  const labels: string[] = []
  const data: number[]   = []

  days.forEach(d => {
    running += byDay[d]
    if (running > peak) peak = running
    labels.push(format(new Date(`${d}T12:00:00`), 'MMM d'))
    data.push(parseFloat((-(peak - running)).toFixed(2)))
  })

  return { labels, data }
}

// ─── Symbol stats ────────────────────────────────────────────────────────────

export function calcSymbolStats(trades: TradeRow[]): SymbolStats[] {
  const map: Record<string, SymbolStats> = {}

  closedTrades(trades).forEach(t => {
    if (!map[t.symbol]) {
      map[t.symbol] = { symbol: t.symbol, pnl: 0, trades: 0, wins: 0, grossWin: 0, grossLoss: 0 }
    }
    const s = map[t.symbol]
    s.pnl    += t.pnl
    s.trades += 1
    if (t.pnl > 0) { s.wins += 1; s.grossWin  += t.pnl }
    else             {              s.grossLoss += t.pnl }
  })

  return Object.values(map).sort((a, b) => b.pnl - a.pnl)
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

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
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? grossWin : 0)
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
