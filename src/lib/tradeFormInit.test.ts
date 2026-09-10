import { describe, expect, it } from 'vitest'
import { shouldPopulateForm, tradeFormKey, shouldPrefillPnlOverride } from './tradeFormInit'
import type { TradeRow } from './types'

const trade = (o: Partial<TradeRow>): TradeRow => ({
  id: 'x', user_id: 'u', symbol: 'MSTR', type: 'Long', asset_type: 'stock',
  entry: 0, exit: null, shares: 0, commission: 0, pnl: 0, risk: 0,
  date: '2026-01-01', exit_date: null, setup: null, grade: null, notes: null,
  tags: [], screenshot_urls: [], screenshot_url: null, strategy_id: null,
  account_id: null, trade_group_id: null, created_at: '', updated_at: '',
  pnl_is_override: false,
  ...o,
} as TradeRow)

describe('tradeFormKey', () => {
  it('is null while the modal is closed', () => {
    expect(tradeFormKey(false, 'abc')).toBeNull()
  })
  it('distinguishes a new trade from editing one', () => {
    expect(tradeFormKey(true, null)).toBe('new')
    expect(tradeFormKey(true, 'abc')).toBe('edit:abc')
  })
})

describe('shouldPopulateForm', () => {
  it('populates the first time a trade opens', () => {
    const r = shouldPopulateForm(null, true, 'abc')
    expect(r).toEqual({ populate: true, nextKey: 'edit:abc' })
  })

  it('does NOT re-populate on a later render of the same open trade', () => {
    // this is the regression: the strategies list changing (e.g. after the
    // user creates a strategy inline) must not wipe the form back to defaults
    const first = shouldPopulateForm(null, true, 'abc')
    const second = shouldPopulateForm(first.nextKey, true, 'abc')
    expect(second.populate).toBe(false)
    expect(second.nextKey).toBe('edit:abc')
  })

  it('re-populates when the modal switches to a different trade', () => {
    const r = shouldPopulateForm('edit:abc', true, 'xyz')
    expect(r).toEqual({ populate: true, nextKey: 'edit:xyz' })
  })

  it('resets when the modal closes, so the next open populates again', () => {
    const closed = shouldPopulateForm('edit:abc', false, null)
    expect(closed).toEqual({ populate: false, nextKey: null })
    const reopened = shouldPopulateForm(closed.nextKey, true, 'abc')
    expect(reopened.populate).toBe(true)
  })
})

describe('shouldPrefillPnlOverride', () => {
  it('does NOT pre-fill for an open trade (no exit) — the bug: pre-filling 0 here let closing it later save a stale 0 + stamp pnl_is_override', () => {
    // MSTR: entry 131.98, no exit yet, stored pnl 0.
    expect(shouldPrefillPnlOverride(trade({ entry: 131.98, exit: null, shares: 43, pnl: 0 }))).toBe(false)
  })

  it('does NOT pre-fill for a normal closed trade whose stored pnl matches the fills', () => {
    // (128.39 - 131.98) * 43 = -154.37
    expect(shouldPrefillPnlOverride(trade({ entry: 131.98, exit: 128.39, shares: 43, pnl: -154.37 }))).toBe(false)
  })

  it('does NOT pre-fill for a genuine breakeven closed trade (entry === exit)', () => {
    expect(shouldPrefillPnlOverride(trade({ entry: 50, exit: 50, shares: 100, pnl: 0 }))).toBe(false)
  })

  it('pre-fills when pnl_is_override is explicitly set, even for an open trade', () => {
    expect(shouldPrefillPnlOverride(trade({ entry: 10, exit: null, shares: 5, pnl: 250, pnl_is_override: true }))).toBe(true)
  })

  it('pre-fills for a legacy closed trade whose stored non-zero pnl disagrees with the fills', () => {
    // fills say -154.37, stored says -100 -> looks like a hand-entered override
    expect(shouldPrefillPnlOverride(trade({ entry: 131.98, exit: 128.39, shares: 43, pnl: -100 }))).toBe(true)
  })

  it('pre-fills for a closed trade whose fills cannot be computed (unrecognized futures contract)', () => {
    expect(shouldPrefillPnlOverride(trade({ asset_type: 'futures', symbol: 'ZZZZ99', entry: 100, exit: 110, shares: 1, pnl: 42 }))).toBe(true)
  })
})
