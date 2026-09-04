// Standard equity option contract size. A small number of "mini" options exist
// (10 shares instead of 100) but they're rare enough that defaulting to 100 and
// letting the user override P&L manually for the rare exception is the safer bet
// than guessing wrong in the other direction for the common case.
export const OPTION_MULTIPLIER = 100

// Point values for common retail futures contracts — i.e. how many dollars one
// full point of price movement is worth, per contract. This list covers the
// contracts retail futures traders overwhelmingly use; anything not on this list
// falls back to 1 (see futuresPointValue below), which under-calculates P&L the
// same way the old bug did — but importers surface that as a visible warning
// instead of a silent wrong number, so it can be corrected by hand.
const FUTURES_POINT_VALUES: Record<string, number> = {
  // Equity index
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
  // Energy
  CL: 1000, MCL: 100, NG: 10000, QG: 2500, RB: 42000, HO: 42000,
  // Metals
  GC: 100, MGC: 10, SI: 5000, SIL: 1000, HG: 25000, PL: 50,
  // Rates
  ZB: 1000, ZN: 1000, ZF: 1000, ZT: 2000, UB: 1000,
  // Grains / Ags
  ZC: 50, ZS: 50, ZW: 50, ZL: 600, ZM: 100,
  // FX futures (per point of the quoted price, standard contract size)
  '6E': 125000, '6J': 12500000, '6B': 62500, '6A': 100000, '6C': 100000,
}

// tick_size = minimum price movement for the contract, in points. A stop of N
// ticks converts to N × tick_size points. Sourced from CME contract specs.
// Getting a tick size wrong = silently wrong risk math, same bug class as the
// old options 100x issue — verify against the broker before trusting.
export type FuturesContractInfo = { symbol: string; name: string; category: string; tick_size: number }

export const FUTURES_CONTRACTS: FuturesContractInfo[] = [
  { symbol: 'ES', name: 'E-mini S&P 500', category: 'Equity index', tick_size: 0.25 },
  { symbol: 'MES', name: 'Micro E-mini S&P 500', category: 'Equity index', tick_size: 0.25 },
  { symbol: 'NQ', name: 'E-mini Nasdaq-100', category: 'Equity index', tick_size: 0.25 },
  { symbol: 'MNQ', name: 'Micro E-mini Nasdaq-100', category: 'Equity index', tick_size: 0.25 },
  { symbol: 'YM', name: 'E-mini Dow', category: 'Equity index', tick_size: 1 },
  { symbol: 'MYM', name: 'Micro E-mini Dow', category: 'Equity index', tick_size: 1 },
  { symbol: 'RTY', name: 'E-mini Russell 2000', category: 'Equity index', tick_size: 0.1 },
  { symbol: 'M2K', name: 'Micro E-mini Russell 2000', category: 'Equity index', tick_size: 0.1 },
  { symbol: 'CL', name: 'Crude Oil', category: 'Energy', tick_size: 0.01 },
  { symbol: 'MCL', name: 'Micro Crude Oil', category: 'Energy', tick_size: 0.01 },
  { symbol: 'NG', name: 'Natural Gas', category: 'Energy', tick_size: 0.001 },
  { symbol: 'QG', name: 'Micro Natural Gas', category: 'Energy', tick_size: 0.005 },
  { symbol: 'RB', name: 'RBOB Gasoline', category: 'Energy', tick_size: 0.0001 },
  { symbol: 'HO', name: 'Heating Oil', category: 'Energy', tick_size: 0.0001 },
  { symbol: 'GC', name: 'Gold', category: 'Metals', tick_size: 0.1 },
  { symbol: 'MGC', name: 'Micro Gold', category: 'Metals', tick_size: 0.1 },
  { symbol: 'SI', name: 'Silver', category: 'Metals', tick_size: 0.005 },
  { symbol: 'SIL', name: 'Micro Silver', category: 'Metals', tick_size: 0.005 },
  { symbol: 'HG', name: 'Copper', category: 'Metals', tick_size: 0.0005 },
  { symbol: 'PL', name: 'Platinum', category: 'Metals', tick_size: 0.1 },
  { symbol: 'ZB', name: '30-Year T-Bond', category: 'Rates', tick_size: 1 / 32 },
  { symbol: 'UB', name: 'Ultra T-Bond', category: 'Rates', tick_size: 1 / 32 },
  { symbol: 'ZN', name: '10-Year T-Note', category: 'Rates', tick_size: 1 / 64 },
  { symbol: 'ZF', name: '5-Year T-Note', category: 'Rates', tick_size: 1 / 64 },
  { symbol: 'ZT', name: '2-Year T-Note', category: 'Rates', tick_size: 1 / 128 },
  { symbol: 'ZC', name: 'Corn', category: 'Grains', tick_size: 0.25 },
  { symbol: 'ZS', name: 'Soybeans', category: 'Grains', tick_size: 0.25 },
  { symbol: 'ZW', name: 'Wheat', category: 'Grains', tick_size: 0.25 },
  { symbol: 'ZL', name: 'Soybean Oil', category: 'Grains', tick_size: 0.01 },
  { symbol: 'ZM', name: 'Soybean Meal', category: 'Grains', tick_size: 0.1 },
  { symbol: '6E', name: 'Euro FX', category: 'Currencies', tick_size: 0.0001 },
  { symbol: '6B', name: 'British Pound', category: 'Currencies', tick_size: 0.0001 },
  { symbol: '6J', name: 'Japanese Yen', category: 'Currencies', tick_size: 0.0000005 },
  { symbol: '6A', name: 'Australian Dollar', category: 'Currencies', tick_size: 0.0001 },
  { symbol: '6C', name: 'Canadian Dollar', category: 'Currencies', tick_size: 0.0001 },
]

// Returns the tick size (in points) for a symbol, or null when the contract
// isn't recognized. Symmetric with futuresPointValue() so callers can handle
// the unknown case explicitly rather than silently defaulting to something.
export function futuresTickSize(symbol: string): number | null {
  const root = futuresRootSymbol(symbol)
  return FUTURES_CONTRACTS.find(fc => fc.symbol === root)?.tick_size ?? null
}

// Strips a broker's contract-month/year suffix (e.g. "ESH26", "NQZ25", "/ESH6",
// "@ES") down to the root symbol so it can be looked up above. Broker symbol
// formats vary; this covers the common patterns but isn't exhaustive.
export function futuresRootSymbol(symbol: string): string {
  return symbol
    .replace(/^[/@]/, '')
    .replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, '')
    .toUpperCase()
    .trim()
}

// Returns null (not a number) when the contract isn't recognized, so callers
// can tell the difference between "$1/point confirmed" and "we don't know" —
// critical, since silently assuming $1/point is exactly the bug being fixed.
export function futuresPointValue(symbol: string): number | null {
  const root = futuresRootSymbol(symbol)
  return FUTURES_POINT_VALUES[root] ?? null
}

// Forex "shares" in this app means lots (see ASSET_TYPES in types.ts: unit
// label "Lots"). A standard lot is 100,000 units of the base currency. For a
// pair quoted AS "...USD" (USD is the quote currency — EUR/USD, GBP/USD,
// AUD/USD, NZD/USD), (exit - entry) * lots * 100,000 is already a USD P&L, so
// one constant multiplier is correct. A USD-BASE pair (USD/JPY, USD/CHF,
// USD/CAD, ...) would need a live FX conversion to express the P&L in USD,
// which this app doesn't do — those fall through to null (unrecognized), the
// same "don't silently guess" contract futuresPointValue already follows.
const FOREX_STANDARD_LOT = 100000
const FOREX_USD_QUOTE_PAIRS = new Set(['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'])

export function forexRootSymbol(symbol: string): string {
  return symbol.replace(/[\s/_-]/g, '').toUpperCase().trim()
}

export function forexLotValue(symbol: string): number | null {
  return FOREX_USD_QUOTE_PAIRS.has(forexRootSymbol(symbol)) ? FOREX_STANDARD_LOT : null
}

// Heuristic: does this symbol look like a futures contract at all (root + month
// code + year, optionally prefixed with / or @)? This is checked separately from
// futuresPointValue so callers can tell "this is a futures symbol we don't
// recognize" apart from "this isn't a futures symbol in the first place."
export function looksLikeFuturesSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase()
  return /^[/@]?[A-Z]{1,3}[FGHJKMNQUVXZ]\d{1,2}$/.test(s)
}

// Extracts the underlying stock ticker from an option symbol, so its chart can
// show the underlying's price action (options don't have their own continuous
// price history to chart). Handles OCC format ("AAPL260117C00150000"), TOS's
// descriptive format ("AAPL 17 JAN 26 150 C"), and plain tickers typed directly
// via manual entry (already just "AAPL", nothing to strip).
export function underlyingFromOptionSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  const occMatch = s.replace(/\s/g, '').match(/^([A-Z]{1,6})\d{6}[CP]\d{8}$/)
  if (occMatch) return occMatch[1]
  const firstToken = s.split(/\s+/)[0]
  return firstToken || s
}

// Heuristic detection for option symbols in formats that don't come with an
// explicit "instrument type" column (e.g. OCC format "AAPL260117C00150000",
// or a broker's descriptive format like "AAPL 17 JAN 26 150 C").
export function looksLikeOptionSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase()
  // OCC format: ROOT + YYMMDD + C/P + strike(8 digits)
  if (/^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(s.replace(/\s/g, ''))) return true
  // Descriptive format containing a strike + call/put marker, e.g. "150 C" or "150C"
  if (/\b\d+(\.\d+)?\s?[CP]\b/.test(s) && /\d{1,2}\s?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i.test(s)) return true
  return false
}