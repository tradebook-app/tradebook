import type { TradeRow } from '@/lib/types'

export type ParsedMt4Trade = {
  ticket: string
  symbol: string
  type: 'Long' | 'Short'
  date: string        // ISO — open time
  exitDate: string     // ISO — close time
  entry: number
  exit: number
  shares: number        // lot size
  pnl: number            // MT4's raw "Profit" column — commission/swap tracked separately, matching how other Sleektrade importers (e.g. IBKR) keep commission out of pnl
  commission: number     // commission + |swap| combined, since Sleektrade has one cost field
  duplicate: boolean
  tradeGroupId: string | null
}

type Cell = { text: string; title: string | null }

function extractCells(rowHtml: string): Cell[] {
  const cells: Cell[] = []
  const cellRegex = /<td([^>]*)>([\s\S]*?)<\/td>/gi
  let m: RegExpExecArray | null
  while ((m = cellRegex.exec(rowHtml))) {
    const titleMatch = m[1].match(/title="([^"]*)"/)
    const text = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    cells.push({ text, title: titleMatch ? titleMatch[1] : null })
  }
  return cells
}

// MT4 date format: "2026.07.15 21:49:28"
function parseMt4DateTime(raw: string): Date | null {
  const m = raw.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
}

// MT4 numbers use a space as the thousands separator, e.g. "10 000.00"
function parseMt4Number(raw: string): number {
  return parseFloat(raw.replace(/\s/g, '')) || 0
}

export function parseMT4(html: string, existingTrades: TradeRow[]): ParsedMt4Trade[] {
  const sectionMatch = html.match(/Closed Transactions:[\s\S]*?(?=Open Trades:)/i)
  if (!sectionMatch) {
    throw new Error('Could not find a "Closed Transactions" section. Make sure this is an MT4/MT5 Account History report saved via Account History → right-click → Save as Report.')
  }

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rawRows: string[] = []
  let m: RegExpExecArray | null
  while ((m = rowRegex.exec(sectionMatch[0]))) rawRows.push(m[1])

  type RawTrade = {
    ticket: string
    partCloseOf: string | null
    symbol: string
    type: 'Long' | 'Short'
    openDt: Date
    closeDt: Date
    entry: number
    exit: number
    lots: number
    commission: number
    swap: number
    profit: number
  }

  const raw: RawTrade[] = []

  for (const rowHtml of rawRows) {
    const cells = extractCells(rowHtml)
    if (cells.length < 14) continue // header row, totals row, or malformed
    if (cells[0].text.toLowerCase() === 'ticket') continue // header row

    const typeText = cells[2].text.toLowerCase()
    if (typeText === 'balance' || typeText === 'credit') continue // deposits/withdrawals, not trades
    if (typeText !== 'buy' && typeText !== 'sell') continue

    const openDt  = parseMt4DateTime(cells[1].text)
    const closeDt = parseMt4DateTime(cells[8].text)
    if (!openDt || !closeDt) continue

    const partCloseMatch = cells[0].title?.match(/part\.close.*#(\d+)/i)

    raw.push({
      ticket: cells[0].text,
      partCloseOf: partCloseMatch ? partCloseMatch[1] : null,
      symbol: cells[4].text.toUpperCase(),
      type: typeText === 'sell' ? 'Short' : 'Long',
      openDt,
      closeDt,
      entry: parseMt4Number(cells[5].text),
      exit: parseMt4Number(cells[9].text),
      lots: parseMt4Number(cells[3].text),
      commission: parseMt4Number(cells[10].text),
      swap: parseMt4Number(cells[12].text),
      profit: parseMt4Number(cells[13].text),
    })
  }

  if (raw.length === 0) {
    throw new Error('No closed trades found in this report. Only fully closed trades are imported — open positions still show in MT4\'s "Open Trades" section and will import once you close them.')
  }

  // Group partial closes: a row referencing another ticket via "part.close p&l for #X"
  // shares a trade_group_id with that original ticket.
  const ticketToGroup: Record<string, string> = {}
  for (const t of raw) {
    if (t.partCloseOf) {
      const groupId = ticketToGroup[t.partCloseOf] || `mt4-${t.partCloseOf}`
      ticketToGroup[t.partCloseOf] = groupId
      ticketToGroup[t.ticket] = groupId
    }
  }

  const existingSigs = new Set(
    existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
  )

  return raw.map(t => {
    const pnl = parseFloat(t.profit.toFixed(2))
    const dateStr = t.openDt.toISOString()
    const sig = `${t.symbol}-${dateStr.substring(0, 10)}-${pnl}`

    return {
      ticket: t.ticket,
      symbol: t.symbol,
      type: t.type,
      date: dateStr,
      exitDate: t.closeDt.toISOString(),
      entry: t.entry,
      exit: t.exit,
      shares: t.lots,
      pnl,
      commission: parseFloat((t.commission + Math.abs(t.swap)).toFixed(2)),
      duplicate: existingSigs.has(sig),
      tradeGroupId: ticketToGroup[t.ticket] || null,
    }
  })
}
