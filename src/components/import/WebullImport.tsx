'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'
import { fetchOpenLegs, replaceOpenLeg } from '@/lib/legMatcher'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: (trades: TradeRow[]) => void
}

type ParsedTrade = {
  symbol:    string
  type:      'Long' | 'Short'
  date:      string
  entry:     number
  exit:      number
  exitDate:  string | null
  shares:    number
  pnl:       number
  duplicate: boolean
  tradeGroupId: string
}

function newGroupId(): string {
  return (globalThis.crypto as any)?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function WebullImport({ userId, existingTrades, onImported }: Props) {
  const [step,      setStep]      = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsed,    setParsed]    = useState<ParsedTrade[]>([])
  const [selected,  setSelected]  = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [imported,  setImported]  = useState(0)
  const [error,     setError]     = useState('')
  const [notice,    setNotice]    = useState('')

  async function parseCSV(text: string): Promise<{ trades: ParsedTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('File appears empty')

    // Find header row
    const headerIdx = lines.findIndex(l =>
      l.toLowerCase().includes('symbol') || l.toLowerCase().includes('time')
    )
    if (headerIdx === -1) throw new Error('Could not find header row. Make sure this is a Webull order history export.')

    // Webull exports comma-separated
    const splitRow = (line: string) =>
      line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))

    const headers = splitRow(lines[headerIdx]).map(h => h.toLowerCase().replace(/\s+/g, ''))
    const rows    = lines.slice(headerIdx + 1)

    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.findIndex(h => h.includes(n))
        if (i >= 0) return i
      }
      return -1
    }

    const timeCol   = col(['time', 'date', 'filledtime', 'createtime'])
    const symCol    = col(['symbol', 'ticker'])
    const sideCol   = col(['side', 'action', 'buysell'])
    const qtyCol    = col(['qty', 'quantity', 'filledqty', 'shares'])
    const priceCol  = col(['averagefillprice', 'avgprice', 'avgfillprice', 'price', 'filledprice'])
    const orderCol  = col(['orderid', 'order#', 'ordernum', 'id'])

    if (symCol < 0) throw new Error('Symbol column not found. Check that this is a Webull order history CSV.')
    if (sideCol < 0) throw new Error('Side (Buy/Sell) column not found.')

    // Build existing trade signatures for duplicate detection
    const existingSigs = new Set(
      existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
    )

    // Step 1: Group fills by Order ID (or fallback: symbol+side+date) to collapse partial fills
    const orderGroups: Record<string, {
      symbol: string
      side:   string
      date:   string
      totalQty:  number
      totalCost: number
    }> = {}

    rows.forEach(row => {
      if (!row.trim()) return
      const cols = splitRow(row)

      const symbol = symCol >= 0 ? cols[symCol]?.toUpperCase().trim() : ''
      if (!symbol) return

      const side  = sideCol >= 0 ? cols[sideCol]?.toLowerCase().trim() : ''
      const qty   = qtyCol  >= 0 ? parseFloat(cols[qtyCol])  || 0 : 0
      const price = priceCol >= 0 ? parseFloat(cols[priceCol]) || 0 : 0

      let dateStr = new Date().toISOString()
      if (timeCol >= 0 && cols[timeCol]) {
        const d = new Date(cols[timeCol])
        if (!isNaN(d.getTime())) dateStr = d.toISOString()
      }

      const dateKey = dateStr.substring(0, 10)
      // Use Order ID if available, otherwise fallback to symbol+side+date
      const orderId = orderCol >= 0 ? cols[orderCol]?.trim() : ''
      const key = orderId ? orderId : `${symbol}-${side}-${dateKey}`

      if (!orderGroups[key]) {
        orderGroups[key] = { symbol, side, date: dateStr, totalQty: 0, totalCost: 0 }
      }
      orderGroups[key].totalQty  += qty
      orderGroups[key].totalCost += price * qty
    })

    // Step 2: Separate into BUY and SELL groups per symbol+date, then match to calculate P&L
    // Key: symbol-date
    const buyMap:  Record<string, { qty: number; avgPrice: number; date: string }[]> = {}
    const sellMap: Record<string, { qty: number; avgPrice: number; date: string }[]> = {}

    Object.values(orderGroups).forEach(g => {
      const avgPrice = g.totalQty > 0 ? g.totalCost / g.totalQty : 0
      const dateKey  = g.date.substring(0, 10)
      const mapKey   = `${g.symbol}-${dateKey}`
      const isBuy    = g.side.startsWith('b') || g.side === 'buy'

      const entry = { qty: g.totalQty, avgPrice, date: g.date }
      if (isBuy) {
        if (!buyMap[mapKey])  buyMap[mapKey]  = []
        buyMap[mapKey].push(entry)
      } else {
        if (!sellMap[mapKey]) sellMap[mapKey] = []
        sellMap[mapKey].push(entry)
      }
    })

    // Step 3: Match buys to sells to produce completed trades
    const trades: ParsedTrade[] = []
    const carriedForward: { symbol: string; side: string; qty: number }[] = []

    // Collect all unique symbol-date keys
    const allKeys = new Set([...Object.keys(buyMap), ...Object.keys(sellMap)])

    const symbolsInFile = [...new Set(Object.values(orderGroups).map(g => g.symbol))]
    const storedLegsBySymbol = await fetchOpenLegs(userId, symbolsInFile)
    const usedStoredLeg = new Set<string>()

    for (const mapKey of allKeys) {
      const [symbol] = mapKey.split('-')
      let buys  = buyMap[mapKey]  || []
      let sells = sellMap[mapKey] || []

      if (buys.length === 0 && sells.length === 0) continue

      const storedLegs  = usedStoredLeg.has(symbol) ? [] : (storedLegsBySymbol[symbol] || [])
      const consumedIds = storedLegs.map(l => l.id)
      if (storedLegs.length > 0) usedStoredLeg.add(symbol)
      const tradeGroupId = storedLegs.find(l => l.trade_group_id)?.trade_group_id || newGroupId()

      for (const leg of storedLegs) {
        const entry = { qty: leg.qty, avgPrice: leg.price, date: leg.opened_at }
        if (leg.side === 'Long') buys = [entry, ...buys]
        else sells = [entry, ...sells]
      }

      // Compute totals for this symbol-date
      const totalBuyQty   = buys.reduce((s, b)  => s + b.qty, 0)
      const totalSellQty  = sells.reduce((s, s2) => s + s2.qty, 0)
      const avgBuyPrice   = totalBuyQty  > 0 ? buys.reduce((s,  b) => s + b.avgPrice * b.qty, 0)  / totalBuyQty  : 0
      const avgSellPrice  = totalSellQty > 0 ? sells.reduce((s, s2) => s + s2.avgPrice * s2.qty, 0) / totalSellQty : 0

      // Determine if Long or Short
      const isLong   = totalBuyQty >= totalSellQty
      const matchQty = Math.min(totalBuyQty, totalSellQty)
      const tradeType: 'Long' | 'Short' = isLong ? 'Long' : 'Short'

      if (matchQty > 0) {
        const entry = isLong ? avgBuyPrice  : avgSellPrice
        const exit  = isLong ? avgSellPrice : avgBuyPrice
        const pnl   = (avgSellPrice - avgBuyPrice) * matchQty * (isLong ? 1 : -1)

        const allDates  = [...buys, ...sells].map(x => x.date).sort()
        const tradeDate = allDates[0] || new Date().toISOString()

        const closingSide = isLong ? sells : buys
        const exitDate = closingSide.length > 0 ? closingSide.map(x => x.date).sort().slice(-1)[0] : null

        const sig = `${symbol}-${tradeDate.substring(0, 10)}-${parseFloat(pnl.toFixed(2))}`

        trades.push({
          symbol,
          type:      tradeType,
          date:      tradeDate,
          entry:     parseFloat(entry.toFixed(4)),
          exit:      parseFloat(exit.toFixed(4)),
          exitDate,
          shares:    matchQty,
          pnl:       parseFloat(pnl.toFixed(2)),
          duplicate: existingSigs.has(sig),
          tradeGroupId,
        })
      }

      const openingQty   = isLong ? totalBuyQty : totalSellQty
      const openingPrice = isLong ? avgBuyPrice : avgSellPrice
      const openingDates = (isLong ? buys : sells).map(x => x.date).sort()
      const netQty = openingQty - matchQty

      if (netQty > 0) {
        await replaceOpenLeg(userId, symbol, consumedIds, {
          symbol, side: tradeType, qty: netQty,
          price: openingPrice, opened_at: openingDates[0] || new Date().toISOString(),
          commission: 0,
          trade_group_id: tradeGroupId,
        }, 'Webull')
        carriedForward.push({ symbol, side: tradeType, qty: netQty })
      } else if (consumedIds.length > 0) {
        await replaceOpenLeg(userId, symbol, consumedIds, null, 'Webull')
      }
    }

    if (trades.length === 0 && carriedForward.length === 0) {
      throw new Error('No completed trades found. Make sure the file contains filled orders.')
    }

    return {
      trades: trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      carriedForward,
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setNotice('')

    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const text = ev.target?.result as string
        const { trades, carriedForward } = await parseCSV(text)

        if (trades.length === 0) {
          const desc = carriedForward.map(c => `${c.qty} sh ${c.symbol} (${c.side})`).join(', ')
          setNotice(`No trades completed yet — ${desc} saved and waiting for the closing execution in a future import.`)
          return
        }

        setParsed(trades)
        const sel = new Set<number>()
        trades.forEach((t, i) => { if (!t.duplicate) sel.add(i) })
        setSelected(sel)
        setStep('preview')
      } catch (err: any) {
        setError(err.message || 'Failed to parse file')
      }
    }
    reader.readAsText(file)
  }

  function toggleSelect(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === parsed.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(parsed.map((_, i) => i)))
    }
  }

  async function handleImport() {
    setImporting(true)
    const toImport = parsed.filter((_, i) => selected.has(i))
    const results: TradeRow[] = []

    for (const t of toImport) {
      const inserted = await insertTrade({
        symbol:         t.symbol,
        type:           t.type,
        date:           t.date,
        exit_date:      t.exitDate,
        entry:          t.entry,
        exit:           t.exit || null,
        shares:         t.shares,
        pnl:            t.pnl,
        risk:           0,
        commission:     0,
        setup:          null,
        grade:          null,
        tags:           [],
        notes:          'Imported from Webull',
        screenshot_url: null,
        trade_group_id: t.tradeGroupId,
      }, userId)
      if (inserted) results.push(inserted)
    }

    setImported(results.length)
    onImported(results)
    setStep('done')
    setImporting(false)
  }

  function reset() {
    setStep('upload'); setParsed([]); setSelected(new Set())
    setImported(0); setError(''); setNotice('')
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--brd)',
        borderRadius: 'var(--r2)', padding: '48px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
          {imported} trade{imported !== 1 ? 's' : ''} imported!
        </div>
        <div style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '24px' }}>
          Your Webull trades are now in the database. Head to Trade View or Dashboard to see them.
        </div>
        <button className="btn btn-p" onClick={reset}>Import More</button>
      </div>
    )
  }

  // ── Preview screen ───────────────────────────────────────────────────────
  if (step === 'preview') {
    const dups  = parsed.filter(t => t.duplicate).length
    const total = parsed.length

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <button className="btn btn-o" onClick={reset}>← Back</button>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>
            Preview — {total} trade{total !== 1 ? 's' : ''} found
            {dups > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--orange)', marginLeft: '8px' }}>
                · {dups} possible duplicate{dups !== 1 ? 's' : ''} (pre-deselected)
              </span>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>{selected.size} selected</span>
            <button className="btn btn-o" onClick={toggleAll} style={{ fontSize: '10px' }}>
              {selected.size === parsed.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              className="btn btn-p"
              onClick={handleImport}
              disabled={importing || selected.size === 0}
            >
              {importing ? 'Importing...' : `Import ${selected.size} Trade${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: '32px', padding: '8px', borderBottom: '1px solid var(--brd)' }}>
                  <input type="checkbox" checked={selected.size === parsed.length} onChange={toggleAll} />
                </th>
                {['Symbol', 'Side', 'Date', 'Shares', 'Entry', 'Exit', 'P&L', 'Status'].map(h => (
                  <th key={h} style={{
                    fontSize: '9px', fontWeight: 600, color: 'var(--txt3)',
                    textTransform: 'uppercase', letterSpacing: '.06em',
                    padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--brd)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.map((t, i) => (
                <tr
                  key={i}
                  onClick={() => toggleSelect(i)}
                  style={{
                    cursor: 'pointer',
                    opacity: selected.has(i) ? 1 : 0.4,
                    background: t.duplicate ? 'rgba(245,158,11,.04)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--brd)' }}>
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} onClick={e => e.stopPropagation()} />
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.symbol}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--brd)' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                      background: t.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)',
                      color: t.type === 'Short' ? 'var(--red)' : 'var(--ac)',
                    }}>{t.type}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)' }}>
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.shares}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>${t.entry.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>${t.exit.toFixed(2)}</td>
                  <td style={{
                    padding: '8px 12px', fontFamily: 'var(--mono)', fontWeight: 700,
                    color: t.pnl >= 0 ? 'var(--ac)' : 'var(--red)',
                    borderBottom: '1px solid var(--brd)',
                  }}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--brd)' }}>
                    {t.duplicate
                      ? <span style={{ fontSize: '9px', color: 'var(--orange)', background: 'rgba(245,158,11,.1)', padding: '2px 6px', borderRadius: '3px' }}>Possible Duplicate</span>
                      : <span style={{ fontSize: '9px', color: 'var(--ac)', background: 'var(--ac-d)', padding: '2px 6px', borderRadius: '3px' }}>New</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Upload screen ────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Import from Webull</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', lineHeight: 1.6 }}>
          Export your order history from Webull and upload it here. Partial fills are automatically
          collapsed. Buy/sell pairs are matched to calculate P&L. Duplicates are detected automatically.
        </div>
      </div>

      {/* How to export instructions */}
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--brd)',
        borderRadius: 'var(--r2)', padding: '16px 20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '10px' }}>
          How to export from Webull Desktop:
        </div>
        {[
          'Open Webull Desktop',
          'Go to Account → Orders → Order History',
          'Set your date range (max 90 days per export)',
          'Filter by Status: Fully Filled',
          'Click the Export button and save as CSV',
          'Upload the file below',
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ac)', minWidth: '16px' }}>{i + 1}.</span>
            <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{s}</span>
          </div>
        ))}
        <div style={{
          marginTop: '12px', fontSize: '10px', color: 'var(--txt3)',
          background: 'rgba(245,158,11,.08)', borderRadius: 'var(--r)',
          padding: '8px 12px', borderLeft: '2px solid var(--orange)',
        }}>
          ⚠️ Webull limits exports to one per day and 90 days per file. Export regularly so you don't lose history.
        </div>
      </div>

      {/* Upload area */}
      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: '40px',
        background: 'var(--bg3)', border: '2px dashed var(--brd2)',
        borderRadius: 'var(--r2)', cursor: 'pointer', transition: '.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ac)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brd2)')}
      >
        <input
          type="file"
          accept=".csv,.txt,.tsv"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <div style={{ fontSize: '28px' }}>📂</div>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Click to upload Webull export file</div>
        <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>Supports .csv files</div>
      </label>

      {error && (
        <div style={{
          marginTop: '12px', background: 'var(--red-d)',
          border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)',
          padding: '10px 14px', fontSize: '11px', color: 'var(--red)',
        }}>
          ⚠️ {error}
        </div>
      )}
      {notice && (
        <div style={{
          marginTop: '12px', background: 'rgba(59,130,246,.1)',
          border: '1px solid rgba(59,130,246,.2)', borderRadius: 'var(--r)',
          padding: '10px 14px', fontSize: '11px', color: '#3B82F6',
        }}>
          ℹ️ {notice}
        </div>
      )}
    </div>
  )
}
