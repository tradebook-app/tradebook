// Persisted defaults for the Position Size page (src/components/PositionSize.tsx).
//
// Only "settings" fields are saved -- account size, risk %, max position %,
// side, and the futures contract/mode/unit toggles. Per-trade inputs (entry,
// stop loss, take profit) are intentionally NOT persisted: they belong to one
// specific trade idea, not the user's standing configuration.
//
// Storage is plain localStorage (per-device), matching how Scanner presets and
// SwingPlanner already persist in this codebase. Stocks and futures values are
// kept in separate sub-objects since they're independent calculators.

export type PositionSizeMode = 'stocks' | 'futures'

export type StockPrefs = {
  account: string
  riskPct: string
  maxPct: string
  side: 'Long' | 'Short'
}

export type FuturesPrefs = {
  futAccount: string
  futRiskMode: 'pct' | 'fixed'
  futRiskInput: string
  futSymbol: string
  futStopUnit: 'points' | 'ticks'
}

export type PositionSizePrefs = {
  mode: PositionSizeMode
  stocks: StockPrefs
  futures: FuturesPrefs
}

// The state each tab's "Clear All" button resets to, and the starting point
// before any saved prefs load. Single source of truth so the calculator, the
// Clear All handlers, and the persistence layer can't drift apart.
export const STOCK_DEFAULTS: StockPrefs = {
  account: '',
  riskPct: '',
  maxPct: '',
  side: 'Long',
}

export const FUTURES_DEFAULTS: FuturesPrefs = {
  futAccount: '',
  futRiskMode: 'pct',
  futRiskInput: '',
  futSymbol: 'ES',
  futStopUnit: 'points',
}

export const POSITION_SIZE_DEFAULTS: PositionSizePrefs = {
  mode: 'stocks',
  stocks: STOCK_DEFAULTS,
  futures: FUTURES_DEFAULTS,
}

const STORAGE_KEY = 'st-position-size-v1'

function asStr(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

// Coerce whatever came out of storage into a fully-populated, correctly-typed
// prefs object. Anything missing, wrong-typed, or an unrecognised enum value
// falls back to its default -- a corrupt or partial blob can never break the
// page or smuggle in an invalid toggle state.
export function normalizePositionSizePrefs(raw: unknown): PositionSizePrefs {
  if (!raw || typeof raw !== 'object') return POSITION_SIZE_DEFAULTS
  const p = raw as Record<string, any>
  const s = (p.stocks && typeof p.stocks === 'object') ? p.stocks : {}
  const f = (p.futures && typeof p.futures === 'object') ? p.futures : {}
  return {
    mode: p.mode === 'futures' ? 'futures' : 'stocks',
    stocks: {
      account: asStr(s.account),
      riskPct: asStr(s.riskPct),
      maxPct: asStr(s.maxPct),
      side: s.side === 'Short' ? 'Short' : 'Long',
    },
    futures: {
      futAccount: asStr(f.futAccount),
      futRiskMode: f.futRiskMode === 'fixed' ? 'fixed' : 'pct',
      futRiskInput: asStr(f.futRiskInput),
      futSymbol: asStr(f.futSymbol) || FUTURES_DEFAULTS.futSymbol,
      futStopUnit: f.futStopUnit === 'ticks' ? 'ticks' : 'points',
    },
  }
}

export function loadPositionSizePrefs(): PositionSizePrefs {
  if (typeof window === 'undefined') return POSITION_SIZE_DEFAULTS
  try {
    return normalizePositionSizePrefs(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
  } catch {
    return POSITION_SIZE_DEFAULTS
  }
}

export function savePositionSizePrefs(prefs: PositionSizePrefs): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // storage full / disabled / private mode -- persistence is best-effort
  }
}
