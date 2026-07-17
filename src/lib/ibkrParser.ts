import type { SupabaseClient } from '@supabase/supabase-js'
import type { TradeRow } from '@/lib/types'
import { fetchOpenLegsWithClient, replaceOpenLegWithClient } from '@/lib/legMatcher'

type DbClient = SupabaseClient<any, any, any>

export type ParsedIbkrTrade = {
  symbol: string
  type: 'Long' | 'Short'
  date: string
  entry: number
  exit: number
  exitDate: string
  shares: number
  pnl: number
  entryTime: string
  exitTime: string
  holdMinutes: number
  commission: number
  duplicate: boolean
  tradeGroupId: string
  assetType: TradeRow['asset_type']
}

type Execution = {
  datetime: Date
  symbol: string
  qty: number       // signed: positive = buy, negative = sell
  price: number
  commission: number
  realizedPnl: number
  assetCategory: string  // IBKR's raw AssetClass value: STK, OPT, FUT, FOP, CASH, etc.
}

// Maps IBKR's AssetClass codes to Sleektrade's asset_type. Unrecognized codes
// (e.g. warrants, bonds) default to 'stock' — P&L is unaffected either way since
// IBKR's own realized P&L is used directly, this only controls the unit label.
function mapAssetCategory(raw: string): TradeRow['asset_type'] {
  const c = raw.trim().toUpperCase()
  if (c === 'OPT' || c === 'FOP') return 'option'
  if (c === 'FUT') return 'futures'
  if (c === 'CASH') return 'forex'
  return 'stock'
}

// ── Quote-aware CSV line splitter (shared by both formats) ──────────────────
function splitCsvLine(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuote = !inQuote; continue }
    if (ch === ',' && !inQuote) { cols.push(current.trim()); current = ''; continue }
    current += ch
  }
  cols.push(current.trim())
  return cols
}

// ── Format A: IBKR Activity Statement export (multi-section report) ─────────
// Lines look like: Trades,Data,Order,Stocks,USD,AAPL,"2026-01-01, 09:30:00",100,150.00,...
function extractFromActivityStatement(lines: string[]): Execution[] {
  const executions: Execution[] = []

  for (const line of lines) {
    if (!line.startsWith('Trades,Data,Order,Stocks,')) continue
    const cols = splitCsvLine(line)

    // Column layout: Trades,Data,Order,Stocks,USD,Symbol,Date/Time,Quantity,
    // T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
    //                 0     1    2     3     4    5     6         7        8
    const symbol      = (cols[5] || '').toUpperCase().trim()
    const rawTime      = cols[6] || ''
    const qty         = parseFloat(cols[7]) || 0
    const price       = parseFloat(cols[8]) || 0
    const commission  = Math.abs(parseFloat(cols[11]) || 0) // Comm/Fee, not Proceeds (col 10)
    const realizedPnl = parseFloat(cols[13]) || 0            // Realized P/L, not Basis (col 12)

    if (!symbol || !rawTime || qty === 0) continue
    const dt = new Date(rawTime)
    if (isNaN(dt.getTime())) continue

    executions.push({ datetime: dt, symbol, qty, price, commission, realizedPnl, assetCategory: 'STK' })
  }

  return executions
}

// ── Format B: Flex Query CSV export (flat single table, header + data rows) ─
// Header row has plain column names like Symbol, DateTime, Quantity, TradePrice,
// IBCommission, FifoPnlRealized — in whatever order the user's query happens to include.
function findCol(header: string[], candidates: string[]): number {
  const normalized = header.map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
  for (const cand of candidates) {
    const target = cand.toLowerCase().replace(/[^a-z]/g, '')
    const idx = normalized.indexOf(target)
    if (idx !== -1) return idx
  }
  return -1
}

// IBKR Flex DateTime format: "20260101;093000" (date;time) or just "20260101"
function parseFlexDateTime(raw: string): Date | null {
  if (!raw) return null
  const [datePart, timePart] = raw.split(';')
  if (!datePart || datePart.length < 8) return null
  const y = parseInt(datePart.substring(0, 4))
  const mo = parseInt(datePart.substring(4, 6)) - 1
  const d = parseInt(datePart.substring(6, 8))
  if (!timePart) return new Date(y, mo, d)
  const h  = parseInt(timePart.substring(0, 2)) || 0
  const mi = parseInt(timePart.substring(2, 4)) || 0
  const s  = parseInt(timePart.substring(4, 6)) || 0
  return new Date(y, mo, d, h, mi, s)
}

function extractFromFlexCsv(lines: string[]): Execution[] {
  if (lines.length < 2) return []

  const header = splitCsvLine(lines[0]).map(h => h.trim())
  const firstCol = (header[0] || '').toLowerCase()
  if (!firstCol.includes('clientaccountid') && findCol(header, ['Symbol']) === -1) return []

  const symbolIdx      = findCol(header, ['Symbol'])
  const dateTimeIdx     = findCol(header, ['DateTime', 'Date/Time'])
  const tradeDateIdx    = findCol(header, ['TradeDate', 'Trade Date'])
  const qtyIdx          = findCol(header, ['Quantity'])
  const priceIdx        = findCol(header, ['TradePrice', 'T. Price', 'Price'])
  const commissionIdx   = findCol(header, ['IBCommission', 'Commission', 'Comm/Fee'])
  const realizedPnlIdx  = findCol(header, ['FifoPnlRealized', 'RealizedPL', 'Realized P/L'])
  const assetClassIdx   = findCol(header, ['AssetClass', 'Asset Category', 'AssetCategory'])

  const missing: string[] = []
  if (symbolIdx === -1) missing.push('Symbol')
  if (dateTimeIdx === -1 && tradeDateIdx === -1) missing.push('Date/Time (or Trade Date)')
  if (qtyIdx === -1) missing.push('Quantity')
  if (priceIdx === -1) missing.push('Trade Price')
  if (realizedPnlIdx === -1) missing.push('Realized P/L (FifoPnlRealized)')

  if (missing.length > 0) {
    throw new Error(
      `Your Flex Query is missing required fields: ${missing.join(', ')}. Go back to IBKR → edit your Flex Query → Trades section → make sure these fields are checked, then try again.`
    )
  }

  const executions: Execution[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    if (cols.length < header.length - 2) continue // malformed/short row, skip
    if ((cols[0] || '').toLowerCase() === firstCol) continue // repeated header (multi-section export), skip

    const symbol = (cols[symbolIdx] || '').toUpperCase().trim()
    const qty    = parseFloat(cols[qtyIdx]) || 0
    const price  = parseFloat(cols[priceIdx]) || 0
    if (!symbol || qty === 0) continue

    const rawDt = dateTimeIdx !== -1 ? cols[dateTimeIdx] : cols[tradeDateIdx]
    const dt = parseFlexDateTime(rawDt)
    if (!dt || isNaN(dt.getTime())) continue

    const commission  = commissionIdx  !== -1 ? Math.abs(parseFloat(cols[commissionIdx]) || 0) : 0
    const realizedPnl = parseFloat(cols[realizedPnlIdx]) || 0
    const assetCategory = assetClassIdx !== -1 ? (cols[assetClassIdx] || 'STK') : 'STK'

    executions.push({ datetime: dt, symbol, qty, price, commission, realizedPnl, assetCategory })
  }

  return executions
}

function newGroupId(): string {
  return (globalThis.crypto as any)?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ── Shared position-tracking / matching engine (format-agnostic) ────────────
export async function parseIBKR(
  text: string,
  existingTrades: TradeRow[],
  userId: string,
  supabase: DbClient
): Promise<{ trades: ParsedIbkrTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const isActivityStatement = lines.some(l => l.startsWith('Trades,Data,Order,Stocks,') || l.startsWith('Trades,Header,'))

  const executions = isActivityStatement
    ? extractFromActivityStatement(lines)
    : extractFromFlexCsv(lines)

  if (executions.length === 0) {
    throw new Error('No trade executions found. Make sure this is an IBKR Activity Statement or Flex Query CSV with Symbol, Quantity, Trade Price, Date/Time, and Realized P/L fields included.')
  }

  executions.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

  const existingSigs = new Set(
    existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
  )

  type OpenPos = {
    entries: { qty: number; price: number; datetime: Date; commission: number; assetCategory: string }[]
    remainingQty: number
    side: 'Long' | 'Short'
    tradeGroupId: string
  }

  const positions: Record<string, OpenPos | null> = {}
  const trades: ParsedIbkrTrade[] = []
  const consumedLegIds: Record<string, string[]> = {}

  const symbolsInFile = [...new Set(executions.map(e => e.symbol))]
  const storedLegsBySymbol = await fetchOpenLegsWithClient(supabase, userId, symbolsInFile)

  for (const symbol of symbolsInFile) {
    const legs = storedLegsBySymbol[symbol]
    if (!legs || legs.length === 0) continue
    const totalQty  = legs.reduce((s, l) => s + l.qty, 0)
    const totalCost = legs.reduce((s, l) => s + l.qty * l.price, 0)
    const totalComm = legs.reduce((s, l) => s + l.commission, 0)
    const earliest  = legs.map(l => new Date(l.opened_at)).sort((a, b) => a.getTime() - b.getTime())[0]
    positions[symbol] = {
      // Carried-forward legs predate asset category tracking — 'STK' is the safe
      // default (P&L is unaffected regardless, since IBKR's realized P&L is used
      // directly; this only controls the unit label).
      entries: [{ qty: totalQty, price: totalCost / totalQty, datetime: earliest, commission: totalComm, assetCategory: 'STK' }],
      remainingQty: totalQty,
      side: legs[0].side as 'Long' | 'Short',
      tradeGroupId: legs.find(l => l.trade_group_id)?.trade_group_id || newGroupId(),
    }
    consumedLegIds[symbol] = legs.map(l => l.id)
  }

  for (const exec of executions) {
    const { symbol, qty, price, datetime, commission, realizedPnl, assetCategory } = exec
    const isBuy  = qty > 0
    const absQty = Math.abs(qty)

    if (!positions[symbol]) {
      positions[symbol] = {
        entries: [{ qty: absQty, price, datetime, commission, assetCategory }],
        remainingQty: absQty,
        side: isBuy ? 'Long' : 'Short',
        tradeGroupId: newGroupId(),
      }
    } else {
      const pos = positions[symbol]!
      const isClosing =
        (pos.side === 'Long' && !isBuy) ||
        (pos.side === 'Short' && isBuy)

      if (isClosing) {
        const totalShares = pos.entries.reduce((s, e) => s + e.qty, 0)
        const totalCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
        const avgEntry    = totalCost / totalShares
        const totalComm   = pos.entries.reduce((s, e) => s + e.commission, 0) + commission
        const tradeQty    = Math.min(absQty, pos.remainingQty)

        const entryDatetime = pos.entries[0].datetime
        const holdMinutes   = Math.round((datetime.getTime() - entryDatetime.getTime()) / 60000)
        const dateStr       = entryDatetime.toISOString()
        const pnl           = parseFloat(realizedPnl.toFixed(2))
        const sig           = `${symbol}-${dateStr.substring(0, 10)}-${pnl}`

        trades.push({
          symbol,
          type: pos.side,
          date: dateStr,
          entry: parseFloat(avgEntry.toFixed(4)),
          exit: parseFloat(price.toFixed(4)),
          exitDate: datetime.toISOString(),
          shares: tradeQty,
          pnl,
          entryTime: entryDatetime.toLocaleTimeString(),
          exitTime: datetime.toLocaleTimeString(),
          holdMinutes,
          commission: parseFloat(totalComm.toFixed(2)),
          duplicate: existingSigs.has(sig),
          tradeGroupId: pos.tradeGroupId,
          assetType: mapAssetCategory(pos.entries[0].assetCategory || 'STK'),
        })

        pos.remainingQty -= tradeQty
        if (pos.remainingQty <= 0) positions[symbol] = null
      } else {
        pos.entries.push({ qty: absQty, price, datetime, commission, assetCategory })
        pos.remainingQty += absQty
      }
    }
  }

  const carriedForward: { symbol: string; side: string; qty: number }[] = []

  for (const symbol of symbolsInFile) {
    const pos = positions[symbol]
    const consumed = consumedLegIds[symbol] || []

    if (pos && pos.remainingQty > 0) {
      const totalShares = pos.entries.reduce((s, e) => s + e.qty, 0)
      const totalCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
      const totalComm   = pos.entries.reduce((s, e) => s + e.commission, 0)
      const earliest    = pos.entries[0].datetime

      await replaceOpenLegWithClient(supabase, userId, symbol, consumed, {
        symbol, side: pos.side, qty: pos.remainingQty,
        price: totalCost / totalShares, opened_at: earliest.toISOString(),
        commission: totalComm,
        trade_group_id: pos.tradeGroupId,
      }, 'IBKR')

      carriedForward.push({ symbol, side: pos.side, qty: pos.remainingQty })
    } else if (consumed.length > 0) {
      await replaceOpenLegWithClient(supabase, userId, symbol, consumed, null, 'IBKR')
    }
  }

  return { trades, carriedForward }
}
