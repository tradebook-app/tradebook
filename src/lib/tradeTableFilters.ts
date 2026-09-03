import type { TradeRow } from '@/lib/types'

// Trade View is the complete trade log — it shows closed AND open trades.
// "Open" means no exit price has been recorded yet (matches closedTrades /
// openTrades in analytics.ts). These helpers keep the Status filter honest:
// win / loss / breakeven only ever apply to *closed* trades, so an open
// position (pnl 0, no exit) never falls into the Breakeven bucket.

export type TradeStatusFilter = 'all' | 'win' | 'loss' | 'be' | 'open'

export function isTradeClosed(t: Pick<TradeRow, 'exit'>): boolean {
  return !!(t.exit && t.exit > 0)
}

export function filterByStatus<T extends Pick<TradeRow, 'exit' | 'pnl'>>(
  trades: T[],
  status: TradeStatusFilter,
): T[] {
  switch (status) {
    case 'win':  return trades.filter(t => isTradeClosed(t) && t.pnl > 0)
    case 'loss': return trades.filter(t => isTradeClosed(t) && t.pnl < 0)
    case 'be':   return trades.filter(t => isTradeClosed(t) && t.pnl === 0)
    case 'open': return trades.filter(t => !isTradeClosed(t))
    default:     return trades
  }
}
