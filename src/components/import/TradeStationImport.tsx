'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'
import { fetchOpenLegs, replaceOpenLeg } from '@/lib/legMatcher'
import { futuresPointValue, looksLikeFuturesSymbol } from '@/lib/contractMultiplier'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: (trades: TradeRow[]) => void
}

type ParsedTrade = {
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
  pointValueUnknown: boolean
}

function newGroupId(): string {
  return (globalThis.crypto as any)?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TradeStationImport({ userId, existingTrades, onImported }: Props) {
  const [step,      setStep]      = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsed,    setParsed]    = useState<ParsedTrade[]>([])
  const [selected,  setSelected]  = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [imported,  setImported]  = useState(0)
  const [error,     setError]     = useState('')
  const [notice,    setNotice]    = useState('')
  const [dragOver,  setDragOver]  = useState(false)

  async function parseCSV(text: string): Promise<{ trades: ParsedTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('File appears empty')

    // Find header row — TradeStation CSV has a header with Symbol, TradeInd, etc.
    const headerIdx = lines.findIndex(l =>
      l.toLowerCase().includes('symbol') &&
      (l.toLowerCase().includes('tradeind') || l.toLowerCase().includes('quantity') || l.toLowerCase().includes('price'))
    )
    if (headerIdx === -1) throw new Error('Could not find header row. Make sure this is a TradeStation Activity CSV export.')

    const splitRow = (line: string) => line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))

    const headers = splitRow(lines[headerIdx]).map(h => h.toLowerCase().replace(/[\s_#\/]/g, ''))
    const rows    = lines.slice(headerIdx + 1)

    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.findIndex(h => h.includes(n))
        if (i >= 0) return i
      }
      return -1
    }

    const symCol    = col(['symbol'])
    const sideCol   = col(['tradeind', 'buysell', 'side', 'type', 'transaction'])
    const qtyCol    = col(['quantity', 'qty'])
    const priceCol  = col(['price', 'execprice', 'fillprice'])
    const commCol   = col(['commission', 'comm'])
    const dateCol   = col(['date', 'td', 'tradedate'])
    const timeCol   = col(['time', 'activitytime'])
    const orderCol  = col(['orderid', 'order'])
    const amtCol    = col(['amount', 'value', 'netamount'])

    if (symCol < 0)  throw new Error('Symbol column not found. Check that this is a TradeStation Activity CSV.')
    if (sideCol < 0) throw new Error('Buy/Sell column not found.')

    const existingSigs = new Set(
      existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
    )

    // Group fills by Order ID (or symbol+side+date fallback)
    const orderGroups: Record<string, {
      symbol: string
      side:   string
      date:   string
      totalQty:    number
      totalCost:   number
      totalComm:   number
      totalAmount: number
    }> = {}

    rows.forEach(row => {
      if (!row.trim()) return
      const cols = splitRow(row)

      const symbol = symCol >= 0 ? cols[symCol]?.toUpperCase().trim() : ''
      if (!symbol) return

      const side   = sideCol  >= 0 ? cols[sideCol]?.trim().toLowerCase()  : ''
      const qty    = qtyCol   >= 0 ? Math.abs(parseFloat(cols[qtyCol])   || 0) : 0
      const price  = priceCol >= 0 ? Math.abs(parseFloat(cols[priceCol]) || 0) : 0
      const comm   = commCol  >= 0 ? Math.abs(parseFloat(cols[commCol])  || 0) : 0
      const amount = amtCol   >= 0 ? parseFloat(cols[amtCol]) || 0 : 0

      if (qty === 0) return

      // Parse date + time
      let dateStr = new Date().toISOString()
      const rawDate = dateCol >= 0 ? cols[dateCol]?.trim() : ''
      const rawTime = timeCol >= 0 ? cols[timeCol]?.trim() : ''
      if (rawDate) {
        const combined = rawTime ? `${rawDate} ${rawTime}` : rawDate
        const d = new Date(combined)
        if (!isNaN(d.getTime())) dateStr = d.toISOString()
      }

      const dateKey = dateStr.substring(0, 10)
      const orderId = orderCol >= 0 ? cols[orderCol]?.trim() : ''
      const key = orderId ? orderId : `${symbol}-${side}-${dateKey}`

      if (!orderGroups[key]) {
        orderGroups[key] = { symbol, side, date: dateStr, totalQty: 0, totalCost: 0, totalComm: 0, totalAmount: 0 }
      }
      orderGroups[key].totalQty    += qty
      orderGroups[key].totalCost   += price * qty
      orderGroups[key].totalComm   += comm
      orderGroups[key].totalAmount += amount
    })

    // Separate into buys/sells per symbol+date, then match
    const buyMap:  Record<string, { qty: number; avgPrice: number; comm: number; date: string }[]> = {}
    const sellMap: Record<string, { qty: number; avgPrice: number; comm: number; date: string }[]> = {}

    Object.values(orderGroups).forEach(g => {
      const avgPrice = g.totalQty > 0 ? g.totalCost / g.totalQty : 0
      const dateKey  = g.date.substring(0, 10)
      const mapKey   = `${g.symbol}-${dateKey}`

      // TradeStation uses B/BUY for buy, S/SELL for sell
      const isBuy = g.side === 'b' || g.side === 'buy' || g.side === 'bo' || g.side === 'bc'

      const entry = { qty: g.totalQty, avgPrice, comm: g.totalComm, date: g.date }
      if (isBuy) {
        if (!buyMap[mapKey])  buyMap[mapKey]  = []
        buyMap[mapKey].push(entry)
      } else {
        if (!sellMap[mapKey]) sellMap[mapKey] = []
        sellMap[mapKey].push(entry)
      }
    })

    const trades: ParsedTrade[] = []
    const carriedForward: { symbol: string; side: string; qty: number }[] = []
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

      // Merge a stored Long leg into buys (opening side of a long), a stored Short leg into sells (opening side of a short)
      for (const leg of storedLegs) {
        const entry = { qty: leg.qty, avgPrice: leg.price, comm: leg.commission, date: leg.opened_at }
        if (leg.side === 'Long') buys = [entry, ...buys]
        else sells = [entry, ...sells]
      }

      const totalBuyQty  = buys.reduce((s, b)  => s + b.qty, 0)
      const totalSellQty = sells.reduce((s, s2) => s + s2.qty, 0)
      const avgBuyPrice  = totalBuyQty  > 0 ? buys.reduce((s, b)  => s + b.avgPrice * b.qty, 0) / totalBuyQty  : 0
      const avgSellPrice = totalSellQty > 0 ? sells.reduce((s, s2) => s + s2.avgPrice * s2.qty, 0) / totalSellQty : 0
      const totalBuyComm  = buys.reduce((s, b)  => s + b.comm, 0)
      const totalSellComm = sells.reduce((s, s2) => s + s2.comm, 0)

      const isLong   = totalBuyQty >= totalSellQty
      const matchQty = Math.min(totalBuyQty, totalSellQty)
      const tradeType: 'Long' | 'Short' = isLong ? 'Long' : 'Short'

      if (matchQty > 0) {
        const entry = isLong ? avgBuyPrice  : avgSellPrice
        const exit  = isLong ? avgSellPrice : avgBuyPrice
        const commUsed = totalBuyComm * (matchQty / (totalBuyQty || 1)) + totalSellComm * (matchQty / (totalSellQty || 1))
        const isFutures = looksLikeFuturesSymbol(symbol)
        const pv = isFutures ? futuresPointValue(symbol) : null
        const mult = isFutures ? (pv ?? 1) : 1
        const pointValueUnknown = isFutures && pv === null
        const pnl = (avgSellPrice - avgBuyPrice) * matchQty * mult * (isLong ? 1 : -1) - commUsed

        const allDates  = [...buys, ...sells].map(x => x.date).sort()
        const tradeDate = allDates[0] || new Date().toISOString()

        const closingSide = isLong ? sells : buys
        const exitDate = closingSide.length > 0 ? closingSide.map(x => x.date).sort().slice(-1)[0] : null

        const sig = `${symbol}-${tradeDate.substring(0, 10)}-${parseFloat(pnl.toFixed(2))}`

        trades.push({
          symbol,
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
          assetType:  isFutures ? 'futures' : 'stock',
          pointValueUnknown,
        })
      }

      // Leftover on the opening side carries forward to the next import
      const openingQty   = isLong ? totalBuyQty : totalSellQty
      const openingPrice = isLong ? avgBuyPrice : avgSellPrice
      const openingComm  = isLong ? totalBuyComm : totalSellComm
      const openingDates = (isLong ? buys : sells).map(x => x.date).sort()
      const netQty = openingQty - matchQty

      if (netQty > 0) {
        await replaceOpenLeg(userId, symbol, consumedIds, {
          symbol, side: tradeType, qty: netQty,
          price: openingPrice, opened_at: openingDates[0] || new Date().toISOString(),
          commission: openingComm * (netQty / (openingQty || 1)),
          trade_group_id: tradeGroupId,
        }, 'TradeStation')
        carriedForward.push({ symbol, side: tradeType, qty: netQty })
      } else if (consumedIds.length > 0) {
        await replaceOpenLeg(userId, symbol, consumedIds, null, 'TradeStation')
      }
    }

    if (trades.length === 0 && carriedForward.length === 0) {
      throw new Error('No trades found. Make sure the file contains filled trade rows with a valid symbol and quantity.')
    }

    return {
      trades: trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      carriedForward,
    }
  }

  function processFile(file: File | undefined) {
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

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    processFile(e.target.files?.[0])
  }

  function toggleSelect(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === parsed.length) setSelected(new Set())
    else setSelected(new Set(parsed.map((_, i) => i)))
  }

  async function handleImport() {
    setImporting(true)
    const toImport = parsed.filter((_, i) => selected.has(i))
    const results: TradeRow[] = []

    for (const t of toImport) {
      const inserted = await insertTrade({
        symbol:         t.symbol,
        asset_type:     t.assetType,
        type:           t.type,
        date:           t.date,
        exit_date:      t.exitDate,
        entry:          t.entry,
        exit:           t.exit || null,
        shares:         t.shares,
        pnl:            t.pnl,
        risk:           0,
        commission:     t.commission,
        setup:          null,
        grade:          null,
        tags:           [],
        notes:          'Imported from TradeStation',
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

  const card: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--brd)',
    borderRadius: 'var(--r2)', padding: '20px',
    maxWidth: '640px', margin: '0 auto',
  }

  if (step === 'done') {
    return (
      <div style={{ padding: '8px' }}>
        <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
            {imported} trade{imported !== 1 ? 's' : ''} imported!
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '24px' }}>
            Your TradeStation trades are now in the database. Head to Trade View or Dashboard to see them.
          </div>
          <button className="btn btn-p" onClick={reset}>Import More</button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    const dups  = parsed.filter(t => t.duplicate).length
    const total = parsed.length
    return (
      <div style={{ padding: '8px' }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <button className="btn btn-o" onClick={reset}>← Back</button>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>
            Preview — {total} trade{total !== 1 ? 's' : ''} found
            {dups > 0 && <span style={{ fontSize: '10px', color: 'var(--orange)', marginLeft: '8px' }}>· {dups} possible duplicate{dups !== 1 ? 's' : ''} (pre-deselected)</span>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>{selected.size} selected</span>
            <button className="btn btn-o" onClick={toggleAll} style={{ fontSize: '10px' }}>
              {selected.size === parsed.length ? 'Deselect All' : 'Select All'}
            </button>
            <button className="btn btn-p" onClick={handleImport} disabled={importing || selected.size === 0}>
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
                {['Symbol', 'Side', 'Date', 'Shares', 'Entry', 'Exit', 'Commission', 'P&L', 'Status'].map(h => (
                  <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.map((t, i) => (
                <tr key={i} onClick={() => toggleSelect(i)} style={{ cursor: 'pointer', opacity: selected.has(i) ? 1 : 0.4, background: t.duplicate ? 'rgba(245,158,11,.04)' : 'transparent' }}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--brd)' }}>
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} onClick={e => e.stopPropagation()} />
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.symbol}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--brd)' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: t.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)', color: t.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>{t.type}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)' }}>{new Date(t.date).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.shares}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>${t.entry.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>${t.exit.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt3)', borderBottom: '1px solid var(--brd)' }}>-${t.commission.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                    {t.pointValueUnknown && <span title="Unrecognized futures contract — P&L may be inaccurate, verify before importing" style={{ marginLeft: '5px', fontSize: '10px' }}>⚠️</span>}
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
      </div>
    )
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={card}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Import from TradeStation</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '18px' }}>
          Export your activity CSV from TradeStation HUB and upload it here.
          Commissions are included. Duplicates are detected automatically.
        </div>

        <div
          onClick={() => document.getElementById('tradestation-file-input')?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files[0]) }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--ac)' : 'var(--brd2)'}`,
            borderRadius: 'var(--r2)', padding: '34px',
            textAlign: 'center', cursor: 'pointer',
            marginBottom: '14px', transition: '.15s',
          }}
        >
          <div style={{ fontSize: '24px', color: 'var(--txt3)', marginBottom: '6px' }}>⇪</div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Drop your TradeStation export file here</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>or click to browse</div>
          <input id="tradestation-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
        </div>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '8px' }}>How to export from TradeStation:</div>
          {[
            'Log in to my.tradestation.com (HUB)',
            'Click on your account → Activity tab',
            'Set your date range (max 6 months per export)',
            'Click the CSV download button',
            'Upload the file above',
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ac)', minWidth: '16px' }}>{i + 1}.</span>
              <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{s}</span>
            </div>
          ))}
          <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--txt3)', background: 'rgba(245,158,11,.08)', borderRadius: 'var(--r)', padding: '8px 12px', borderLeft: '2px solid var(--orange)' }}>
            ⚠️ TradeStation limits exports to 6 months per file. Use multiple exports for longer date ranges.
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '12px', background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: 'var(--red)' }}>
            ⚠️ {error}
          </div>
        )}
        {notice && (
          <div style={{ marginTop: '12px', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: '#3B82F6' }}>
          ℹ️ {notice}
        </div>
      )}
      </div>
    </div>
  )
}
