import type { SupabaseClient } from '@supabase/supabase-js'
import type { TradeRow } from '@/lib/types'
import { fetchOpenLegsWithClient, replaceOpenLegWithClient } from '@/lib/legMatcher'

type DbClient = SupabaseClient<any, any, any>

export type TTLeg = {
  groupKey:   string   // rows that share this key are treated as one round trip (order id or symbol+date)
  symbol:     string
  action:     string   // 'Buy to Open' | 'Sell to Close' | 'Sell to Open' | 'Buy to Close' | 'Buy' | 'Sell'
  qty:        number
  price:      number
  date:       string   // ISO
  commission: number
}

export type TTExecution = {
  symbol:     string
  isOpen:     boolean  // true for 'Buy to Open' / 'Sell to Open'
  isBuy:      boolean  // true for 'Buy to Open' / 'Buy to Close'
  qty:        number
  price:      number
  date:       Date
  commission: number
}

function newGroupId(): string {
  return (globalThis.crypto as any)?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Chronological position-tracking matcher, used by the API-based auto-sync.
// Unlike the group-based matcher above (which the CSV importer uses and groups
// legs by order/date), this processes every execution in time order per symbol —
// correctly handling opens and closes placed as separate orders on different days,
// and multiple distinct round trips on the same symbol within one sync.
export async function matchTastytradeExecutionsSequential(
  executions: TTExecution[],
  existingTrades: TradeRow[],
  userId: string,
  supabase: DbClient
): Promise<{ trades: ParsedTastytradeTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
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
  const trades: ParsedTastytradeTrade[] = []
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
    const { symbol, qty, price, date, commission, isOpen, isBuy } = exec

    if (isOpen || !positions[symbol]) {
      if (!positions[symbol]) {
        positions[symbol] = { entries: [{ qty, price, date, commission }], remainingQty: qty, side: isBuy ? 'Long' : 'Short', tradeGroupId: newGroupId() }
      } else {
        const pos = positions[symbol]!
        pos.entries.push({ qty, price, date, commission })
        pos.remainingQty += qty
      }
      continue
    }

    // Closing execution
    const pos = positions[symbol]!
    const totalShares = pos.entries.reduce((s, e) => s + e.qty, 0)
    const totalCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
    const avgEntry     = totalCost / totalShares
    const totalComm    = pos.entries.reduce((s, e) => s + e.commission, 0) + commission
    const tradeQty      = Math.min(qty, pos.remainingQty)

    const entryDate = pos.entries[0].date
    const dateStr    = entryDate.toISOString()
    const pnl        = parseFloat((((price - avgEntry) * tradeQty) * (pos.side === 'Long' ? 1 : -1) - totalComm).toFixed(2))
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
      }, 'Tastytrade')

      carriedForward.push({ symbol, side: pos.side, qty: pos.remainingQty })
    } else if (consumed.length > 0) {
      await replaceOpenLegWithClient(supabase, userId, symbol, consumed, null, 'Tastytrade')
    }
  }

  return { trades, carriedForward }
}

export type ParsedTastytradeTrade = {
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
}

// Shared open/close matching engine for Tastytrade, used by both the CSV importer
// and the API-based auto-sync route. Tastytrade doesn't supply a broker-computed
// realized P&L per transaction (unlike IBKR), so P&L is derived here from matched
// open/close average prices — same approach for both entry paths.
export async function matchTastytradeLegs(
  legs: TTLeg[],
  existingTrades: TradeRow[],
  userId: string,
  supabase: DbClient
): Promise<{ trades: ParsedTastytradeTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
  const groups: Record<string, { symbol: string; legs: TTLeg[] }> = {}
  for (const leg of legs) {
    if (!groups[leg.groupKey]) groups[leg.groupKey] = { symbol: leg.symbol, legs: [] }
    groups[leg.groupKey].legs.push(leg)
  }

  const existingSigs = new Set(
    existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
  )

  const trades: ParsedTastytradeTrade[] = []
  const carriedForward: { symbol: string; side: string; qty: number }[] = []

  const symbolsInFile = [...new Set(Object.values(groups).map(g => g.symbol))]
  const storedLegsBySymbol = await fetchOpenLegsWithClient(supabase, userId, symbolsInFile)
  const usedStoredLeg = new Set<string>()

  for (const g of Object.values(groups)) {
    if (g.legs.length === 0) continue

    const fileOpens = g.legs.filter(l => l.action.toLowerCase().includes('open'))
    const closes    = g.legs.filter(l => l.action.toLowerCase().includes('close'))

    const storedLegs  = usedStoredLeg.has(g.symbol) ? [] : (storedLegsBySymbol[g.symbol] || [])
    const consumedIds = storedLegs.map(l => l.id)
    if (storedLegs.length > 0) usedStoredLeg.add(g.symbol)
    const storedGroupId = storedLegs.find(l => l.trade_group_id)?.trade_group_id
    const syntheticOpens: TTLeg[] = storedLegs.map(l => ({
      groupKey: g.symbol, symbol: g.symbol,
      action: l.side === 'Long' ? 'Buy to Open' : 'Sell to Open',
      qty: l.qty, price: l.price, date: l.opened_at, commission: l.commission,
    }))
    const opens = [...syntheticOpens, ...fileOpens]

    if (opens.length === 0 && closes.length === 0) continue

    const tradeGroupId = storedGroupId || newGroupId()

    const firstAction = (opens[0] || closes[0])?.action.toLowerCase() || ''
    const isLong = firstAction.includes('buy to open') ||
                   (!firstAction.includes('sell to open') && firstAction.includes('buy'))

    const tradeType: 'Long' | 'Short' = isLong ? 'Long' : 'Short'

    const openQty  = opens.reduce((s, l)  => s + l.qty, 0)
    const closeQty = closes.reduce((s, l) => s + l.qty, 0)
    const matchQty = Math.min(openQty, closeQty)

    const avgOpenPrice  = openQty  > 0 ? opens.reduce((s, l)  => s + l.price * l.qty, 0) / openQty  : 0
    const avgClosePrice = closeQty > 0 ? closes.reduce((s, l) => s + l.price * l.qty, 0) / closeQty : 0

    const totalOpenComm  = opens.reduce((s, l)  => s + l.commission, 0)
    const totalCloseComm = closes.reduce((s, l) => s + l.commission, 0)

    if (matchQty > 0) {
      const entry = isLong ? avgOpenPrice  : avgClosePrice
      const exit  = isLong ? avgClosePrice : avgOpenPrice
      const commUsed = totalOpenComm * (matchQty / openQty) + totalCloseComm * (matchQty / closeQty)
      const pnl = (avgClosePrice - avgOpenPrice) * matchQty * (isLong ? 1 : -1) - commUsed

      const tradeDate = opens.map(l => l.date).sort()[0]
      const exitDate  = closes.map(l => l.date).sort().slice(-1)[0] || null
      const sig = `${g.symbol}-${tradeDate.substring(0, 10)}-${parseFloat(pnl.toFixed(2))}`

      trades.push({
        symbol:     g.symbol,
        type:       tradeType,
        date:       tradeDate,
        entry:      parseFloat(entry.toFixed(4)),
        exit:       parseFloat(exit.toFixed(4)),
        exitDate,
        shares:     matchQty,
        pnl:        parseFloat(pnl.toFixed(2)),
        commission: parseFloat(commUsed.toFixed(2)),
        duplicate:  existingSigs.has(sig),
        tradeGroupId,
      })
    }

    const netQty = openQty - matchQty
    if (netQty > 0) {
      const leftoverComm = totalOpenComm * (netQty / openQty)
      await replaceOpenLegWithClient(supabase, userId, g.symbol, consumedIds, {
        symbol: g.symbol, side: tradeType, qty: netQty,
        price: avgOpenPrice, opened_at: opens.map(l => l.date).sort()[0],
        commission: leftoverComm,
        trade_group_id: tradeGroupId,
      }, 'Tastytrade')
      carriedForward.push({ symbol: g.symbol, side: tradeType, qty: netQty })
    } else if (consumedIds.length > 0) {
      await replaceOpenLegWithClient(supabase, userId, g.symbol, consumedIds, null, 'Tastytrade')
    }
  }

  return {
    trades: trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    carriedForward,
  }
}
