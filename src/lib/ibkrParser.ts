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
}

// Shared IBKR Activity Statement / Flex Query CSV parser.
// Used by both the client-side CSV upload flow (IbkrImport.tsx) and the
// server-side auto-sync route (api/broker/ibkr/sync) — pass whichever
// Supabase client is appropriate (browser client vs. service-role client).
export async function parseIBKR(
  text: string,
  existingTrades: TradeRow[],
  userId: string,
  supabase: DbClient
): Promise<{ trades: ParsedIbkrTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  type Execution = {
    datetime: Date
    symbol: string
    qty: number
    price: number
    commission: number
    realizedPnl: number
  }

  const executions: Execution[] = []

  for (const line of lines) {
    if (!line.startsWith('Trades,Data,Order,Stocks,')) continue

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

    const symbol      = (cols[5] || '').toUpperCase().trim()
    const rawTime      = cols[6] || ''
    const qty         = parseFloat(cols[7]) || 0
    const price       = parseFloat(cols[8]) || 0
    const commission  = Math.abs(parseFloat(cols[10]) || 0)
    const realizedPnl = parseFloat(cols[12]) || 0

    if (!symbol || !rawTime || qty === 0) continue

    const dt = new Date(rawTime)
    if (isNaN(dt.getTime())) continue

    executions.push({ datetime: dt, symbol, qty, price, commission, realizedPnl })
  }

  if (executions.length === 0) {
    throw new Error('No trade executions found. Make sure this is an IBKR Activity Statement (or Flex Query) with trade data in the standard Trades section format.')
  }

  executions.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

  const existingSigs = new Set(
    existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
  )

  type OpenPos = {
    entries: { qty: number; price: number; datetime: Date; commission: number }[]
    remainingQty: number
    side: 'Long' | 'Short'
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
      entries: [{ qty: totalQty, price: totalCost / totalQty, datetime: earliest, commission: totalComm }],
      remainingQty: totalQty,
      side: legs[0].side as 'Long' | 'Short',
    }
    consumedLegIds[symbol] = legs.map(l => l.id)
  }

  for (const exec of executions) {
    const { symbol, qty, price, datetime, commission, realizedPnl } = exec
    const isBuy  = qty > 0
    const absQty = Math.abs(qty)

    if (!positions[symbol]) {
      positions[symbol] = {
        entries: [{ qty: absQty, price, datetime, commission }],
        remainingQty: absQty,
        side: isBuy ? 'Long' : 'Short',
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
        })

        pos.remainingQty -= tradeQty
        if (pos.remainingQty <= 0) positions[symbol] = null
      } else {
        pos.entries.push({ qty: absQty, price, datetime, commission })
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
      }, 'IBKR')

      carriedForward.push({ symbol, side: pos.side, qty: pos.remainingQty })
    } else if (consumed.length > 0) {
      await replaceOpenLegWithClient(supabase, userId, symbol, consumed, null, 'IBKR')
    }
  }

  return { trades, carriedForward }
}
