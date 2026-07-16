import type { SupabaseClient } from '@supabase/supabase-js'
import type { TradeRow } from '@/lib/types'
import { fetchOpenLegsWithClient, replaceOpenLegWithClient } from '@/lib/legMatcher'
import { OPTION_MULTIPLIER, looksLikeOptionSymbol } from '@/lib/contractMultiplier'

type DbClient = SupabaseClient<any, any, any>

export type WebullExecution = {
  symbol:     string
  isBuy:      boolean
  qty:        number
  price:      number
  date:       Date
  commission: number
}

export type ParsedWebullTrade = {
  symbol:     string
  type:       'Long' | 'Short'
  date:       string
  entry:      number
  exit:       number
  exitDate:   string | null
  shares:     number
  pnl:        number
  commission: number
  duplicate:  boolean
  tradeGroupId: string
  assetType:  TradeRow['asset_type']
  assetTypeGuessed: boolean
}

function newGroupId(): string {
  return (globalThis.crypto as any)?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Webull orders only report BUY/SELL, not an explicit open/close flag — same situation
// as IBKR. This uses the identical chronological position-tracking approach: process
// executions in time order per symbol, inferring open vs. close from the running position.
export async function matchWebullExecutions(
  executions: WebullExecution[],
  existingTrades: TradeRow[],
  userId: string,
  supabase: DbClient
): Promise<{ trades: ParsedWebullTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
  const sorted = [...executions].sort((a, b) => a.date.getTime() - b.date.getTime())

  const existingSigs = new Set(
    existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
  )

  type OpenPos = {
    entries: { qty: number; price: number; date: Date; commission: number }[]
    remainingQty: number
    side: 'Long' | 'Short'
    tradeGroupId: string
  }

  const positions: Record<string, OpenPos | null> = {}
  const trades: ParsedWebullTrade[] = []
  const consumedLegIds: Record<string, string[]> = {}

  const symbolsInFile = [...new Set(sorted.map(e => e.symbol))]
  const storedLegsBySymbol = await fetchOpenLegsWithClient(supabase, userId, symbolsInFile)

  for (const symbol of symbolsInFile) {
    const legs = storedLegsBySymbol[symbol]
    if (!legs || legs.length === 0) continue
    const totalQty  = legs.reduce((s, l) => s + l.qty, 0)
    const totalCost = legs.reduce((s, l) => s + l.qty * l.price, 0)
    const totalComm = legs.reduce((s, l) => s + l.commission, 0)
    const earliest  = legs.map(l => new Date(l.opened_at)).sort((a, b) => a.getTime() - b.getTime())[0]
    positions[symbol] = {
      entries: [{ qty: totalQty, price: totalCost / totalQty, date: earliest, commission: totalComm }],
      remainingQty: totalQty,
      side: legs[0].side as 'Long' | 'Short',
      tradeGroupId: legs.find(l => l.trade_group_id)?.trade_group_id || newGroupId(),
    }
    consumedLegIds[symbol] = legs.map(l => l.id)
  }

  for (const exec of sorted) {
    const { symbol, qty, price, date, commission, isBuy } = exec

    if (!positions[symbol]) {
      positions[symbol] = { entries: [{ qty, price, date, commission }], remainingQty: qty, side: isBuy ? 'Long' : 'Short', tradeGroupId: newGroupId() }
      continue
    }

    const pos = positions[symbol]!
    const isClosing = (pos.side === 'Long' && !isBuy) || (pos.side === 'Short' && isBuy)

    if (!isClosing) {
      pos.entries.push({ qty, price, date, commission })
      pos.remainingQty += qty
      continue
    }

    const totalShares = pos.entries.reduce((s, e) => s + e.qty, 0)
    const totalCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
    const avgEntry     = totalCost / totalShares
    const totalComm    = pos.entries.reduce((s, e) => s + e.commission, 0) + commission
    const tradeQty      = Math.min(qty, pos.remainingQty)

    const entryDate = pos.entries[0].date
    const dateStr    = entryDate.toISOString()
    const isOption   = looksLikeOptionSymbol(symbol)
    const mult       = isOption ? OPTION_MULTIPLIER : 1
    const pnl        = parseFloat((((price - avgEntry) * tradeQty * mult) * (pos.side === 'Long' ? 1 : -1) - totalComm).toFixed(2))
    const sig        = `${symbol}-${dateStr.substring(0, 10)}-${pnl}`

    trades.push({
      symbol,
      type: pos.side,
      date: dateStr,
      entry: parseFloat(avgEntry.toFixed(4)),
      exit: parseFloat(price.toFixed(4)),
      exitDate: date.toISOString(),
      shares: tradeQty,
      pnl,
      commission: parseFloat(totalComm.toFixed(2)),
      duplicate: existingSigs.has(sig),
      tradeGroupId: pos.tradeGroupId,
      assetType: isOption ? 'option' : 'stock',
      assetTypeGuessed: isOption,
    })

    pos.remainingQty -= tradeQty
    if (pos.remainingQty <= 0) positions[symbol] = null
  }

  const carriedForward: { symbol: string; side: string; qty: number }[] = []

  for (const symbol of symbolsInFile) {
    const pos = positions[symbol]
    const consumed = consumedLegIds[symbol] || []

    if (pos && pos.remainingQty > 0) {
      const totalShares = pos.entries.reduce((s, e) => s + e.qty, 0)
      const totalCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
      const totalComm   = pos.entries.reduce((s, e) => s + e.commission, 0)
      const earliest    = pos.entries[0].date

      await replaceOpenLegWithClient(supabase, userId, symbol, consumed, {
        symbol, side: pos.side, qty: pos.remainingQty,
        price: totalCost / totalShares, opened_at: earliest.toISOString(),
        commission: totalComm,
        trade_group_id: pos.tradeGroupId,
      }, 'Webull')

      carriedForward.push({ symbol, side: pos.side, qty: pos.remainingQty })
    } else if (consumed.length > 0) {
      await replaceOpenLegWithClient(supabase, userId, symbol, consumed, null, 'Webull')
    }
  }

  return { trades, carriedForward }
}
