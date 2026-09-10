// Decides whether the Add/Edit Trade form should (re)populate its fields from
// the trade being edited. The form's population effect depends on the
// `strategies` list (it matches a legacy setup label to a strategy), so it
// re-fires whenever that list changes — including right after the user creates
// a strategy inline. Re-populating at that moment throws away the strategy the
// user just picked. This keys population to "which trade, this open" so it runs
// exactly once per open and never fights the user's edits.

import { computeTradePnl } from './analytics'
import type { TradeRow } from './types'

// Whether the Edit Trade form should pre-fill its P&L Override field from the
// stored pnl. True ONLY when that stored value is (or looks like) a deliberate
// manual override:
//   - pnl_is_override is set (the explicit signal, going forward), or
//   - it's a CLOSED trade whose fills can't be computed (an unrecognized
//     futures/forex contract) — the stored value is the only data we have, or
//   - it's a CLOSED trade whose stored non-zero pnl disagrees with the fills
//     (legacy rows that predate the pnl_is_override column).
//
// An OPEN trade's stored pnl is just "not realized yet", never an override.
// The previous check treated `computeTradePnl(t) == null` as "keep the
// override" — but that is null for EVERY open trade (no exit), so opening an
// open trade to close it pre-filled the override field with '0'; saving then
// stored that stale 0 and stamped pnl_is_override=true, hiding the real P&L
// until the user edited and saved a second time.
export function shouldPrefillPnlOverride(t: TradeRow): boolean {
  if (t.pnl_is_override === true) return true
  const isClosed = !!(t.exit && t.exit > 0)
  if (!isClosed) return false
  const computed = computeTradePnl(t)
  if (computed == null) return true
  return t.pnl !== 0 && Math.abs(t.pnl - computed) > 0.01
}

export function tradeFormKey(open: boolean, editTradeId: string | null | undefined): string | null {
  if (!open) return null
  return editTradeId ? `edit:${editTradeId}` : 'new'
}

export function shouldPopulateForm(
  prevKey: string | null,
  open: boolean,
  editTradeId: string | null | undefined,
): { populate: boolean; nextKey: string | null } {
  const key = tradeFormKey(open, editTradeId)
  if (key === null) return { populate: false, nextKey: null }
  if (prevKey === key) return { populate: false, nextKey: key }
  return { populate: true, nextKey: key }
}
