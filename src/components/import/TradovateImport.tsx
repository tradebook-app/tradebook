'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'
import { fetchOpenLegs, replaceOpenLeg } from '@/lib/legMatcher'
import { futuresPointValue } from '@/lib/contractMultiplier'

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
  pointValueUnknown: boolean
}

function newGroupId(): string {
  return (globalThis.crypto as any)?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TradovateImport({ userId, existingTrades, onImported }: Props) {
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

    const headerIdx = lines.findIndex(l => l.toLowerCase().includes('contract') && l.toLowerCase().includes('b/s'))
    if (headerIdx === -1) throw new Error('Could not find header row. Make sure this is a Tradovate Orders CSV export.')

    // Handles quoted fields containing commas, e.g. "3,802,250.00"
    const splitRow = (line: string) => {
      const out: string[] = []
      let cur = '', inQuotes = false
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue }
        if (ch === ',' && !inQuotes) { out.push(cur); cur = '' } else { cur += ch }
      }
      out.push(cur)
      return out.map(c => c.trim())
    }

    const headers = splitRow(lines[headerIdx]).map(h => h.toLowerCase().replace(/[\s_#\/]/g, ''))
    const rows    = lines.slice(headerIdx + 1)

    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.findIndex(h => h.includes(n))
        if (i >= 0) return i
      }
      return -1
    }

    const sideCol    = col(['b/s', 'bs'])
    const contractCol = col(['contract'])
    const productCol = col(['product'])
    const statusCol  = col(['status'])
    const priceCol   = col(['avgfillprice', 'avgprice'])
    const qtyCol     = col(['filledqty', 'quantity'])
    const timeCol    = col(['filltime', 'timestamp'])
    const orderCol   = col(['orderid'])
    const notionalCol = col(['notionalvalue'])

    if (contractCol < 0) throw new Error('Contract column not found. Check that this is a Tradovate Orders CSV.')
    if (sideCol < 0)     throw new Error('B/S column not found.')

    const existingSigs = new Set(
      existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
    )

    // Group fills by Order ID (each row is usually already one fill, but group defensively
    // in case a single order shows multiple partial-fill rows)
    const orderGroups: Record<string, {
      symbol: string   // full contract, e.g. ESU6 — what we store on the trade
      product: string  // root symbol, e.g. ES — used to look up point value
      side: string
      date: string
      totalQty: number
      totalCost: number
      totalNotional: number
    }> = {}

    rows.forEach(row => {
      if (!row.trim()) return
      const cols = splitRow(row)

      const status = statusCol >= 0 ? cols[statusCol]?.trim().toLowerCase() : ''
      if (statusCol >= 0 && status !== 'filled') return // skip working/cancelled/rejected orders

      const symbol  = cols[contractCol]?.toUpperCase().trim()
      if (!symbol) return
      const product = productCol >= 0 ? cols[productCol]?.toUpperCase().trim() : symbol

      const side   = cols[sideCol]?.trim().toLowerCase()
      const qty    = qtyCol   >= 0 ? Math.abs(parseFloat(cols[qtyCol]?.replace(/,/g, '')))   || 0 : 0
      const price  = priceCol >= 0 ? Math.abs(parseFloat(cols[priceCol]?.replace(/,/g, ''))) || 0 : 0
      const notional = notionalCol >= 0 ? Math.abs(parseFloat(cols[notionalCol]?.replace(/,/g, ''))) || 0 : 0
      if (qty === 0) return

      let dateStr = new Date().toISOString()
      const rawTime = timeCol >= 0 ? cols[timeCol]?.trim() : ''
      if (rawTime) {
        const d = new Date(rawTime)
        if (!isNaN(d.getTime())) dateStr = d.toISOString()
      }

      const dateKey = dateStr.substring(0, 10)
      const orderId = orderCol >= 0 ? cols[orderCol]?.trim() : ''
      const key = orderId ? orderId : `${symbol}-${side}-${dateStr}`

      if (!orderGroups[key]) {
        orderGroups[key] = { symbol, product, side, date: dateStr, totalQty: 0, totalCost: 0, totalNotional: 0 }
      }
      orderGroups[key].totalQty      += qty
      orderGroups[key].totalCost     += price * qty
      orderGroups[key].totalNotional += notional
    })

    // Derive each product's real point value directly from the broker's own Notional
    // Value where available — more reliable than a static lookup table, since it comes
    // straight from Tradovate's own math rather than our guess at the contract spec.
    const productMultiplier: Record<string, number> = {}
    for (const g of Object.values(orderGroups)) {
      if (productMultiplier[g.product] != null) continue
      if (g.totalNotional > 0 && g.totalCost > 0) {
        productMultiplier[g.product] = g.totalNotional / g.totalCost
      }
    }

    type OpenPos = {
      product: string
      entries: { qty: number; price: number; date: string }[]
      remainingQty: number
      side: 'Long' | 'Short'
      tradeGroupId: string
    }

    const positions: Record<string, OpenPos | null> = {}
    const trades: ParsedTrade[] = []
    const carriedForward: { symbol: string; side: string; qty: number }[] = []

    const symbolsInFile = [...new Set(Object.values(orderGroups).map(g => g.symbol))]
    const storedLegsBySymbol = await fetchOpenLegs(userId, symbolsInFile)

    for (const symbol of symbolsInFile) {
      const legs = storedLegsBySymbol[symbol]
      if (!legs || legs.length === 0) continue
      const totalQty  = legs.reduce((s, l) => s + l.qty, 0)
      const totalCost = legs.reduce((s, l) => s + l.qty * l.price, 0)
      const earliest  = legs.map(l => l.opened_at).sort()[0]
      const product   = Object.values(orderGroups).find(g => g.symbol === symbol)?.product || symbol
      positions[symbol] = {
        product,
        entries: [{ qty: totalQty, price: totalCost / totalQty, date: earliest }],
        remainingQty: totalQty,
        side: legs[0].side as 'Long' | 'Short',
        tradeGroupId: legs.find(l => l.trade_group_id)?.trade_group_id || newGroupId(),
      }
    }

    const chronological = Object.values(orderGroups).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    for (const g of chronological) {
      const { symbol, product, side, date } = g
      const price = g.totalQty > 0 ? g.totalCost / g.totalQty : 0
      const qty = g.totalQty
      const isBuy = side === 'buy' || side === 'b'

      if (!positions[symbol]) {
        positions[symbol] = {
          product,
          entries: [{ qty, price, date }],
          remainingQty: qty,
          side: isBuy ? 'Long' : 'Short',
          tradeGroupId: newGroupId(),
        }
        continue
      }

      const pos = positions[symbol]!
      const isClosing = (pos.side === 'Long' && !isBuy) || (pos.side === 'Short' && isBuy)

      if (!isClosing) {
        pos.entries.push({ qty, price, date })
        pos.remainingQty += qty
        continue
      }

      const totalEntryShares = pos.entries.reduce((s, e) => s + e.qty, 0)
      const totalEntryCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
      const avgEntry = totalEntryCost / totalEntryShares
      const tradeQty = Math.min(qty, pos.remainingQty)

      const pv = productMultiplier[pos.product] ?? futuresPointValue(pos.product)
      const mult = pv ?? 1
      const pointValueUnknown = pv == null
      const rawPnl = pos.side === 'Long'
        ? (price - avgEntry) * tradeQty * mult
        : (avgEntry - price) * tradeQty * mult

      const entryDate = pos.entries[0].date
      const pnl = parseFloat(rawPnl.toFixed(2))
      const sig = `${symbol}-${entryDate.substring(0, 10)}-${pnl}`

      trades.push({
        symbol,
        type: pos.side,
        date: entryDate,
        entry: parseFloat(avgEntry.toFixed(4)),
        exit: parseFloat(price.toFixed(4)),
        exitDate: date,
        shares: tradeQty,
        pnl,
        commission: 0, // not present in this export
        duplicate: existingSigs.has(sig),
        tradeGroupId: pos.tradeGroupId,
        pointValueUnknown,
      })

      pos.remainingQty -= tradeQty
      if (pos.remainingQty <= 0) positions[symbol] = null
    }

    for (const symbol of symbolsInFile) {
      const pos = positions[symbol]
      const legs = storedLegsBySymbol[symbol]
      const consumedIds = legs ? legs.map(l => l.id) : []

      if (pos && pos.remainingQty > 0) {
        const totalCost = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
        const totalQty  = pos.entries.reduce((s, e) => s + e.qty, 0)
        await replaceOpenLeg(userId, symbol, consumedIds, {
          symbol, side: pos.side, qty: pos.remainingQty,
          price: totalCost / totalQty,
          opened_at: pos.entries[0].date,
          commission: 0,
          trade_group_id: pos.tradeGroupId,
        }, 'Tradovate')
        carriedForward.push({ symbol, side: pos.side, qty: pos.remainingQty })
      } else if (consumedIds.length > 0) {
        await replaceOpenLeg(userId, symbol, consumedIds, null, 'Tradovate')
      }
    }

    if (trades.length === 0 && carriedForward.length === 0) {
      throw new Error('No filled trades found. Make sure the file contains "Filled" order rows with a valid contract and quantity.')
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
          const desc = carriedForward.map(c => `${c.qty} ${c.symbol} (${c.side})`).join(', ')
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
        asset_type:     'futures',
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
        notes:          'Imported from Tradovate',
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
            Your Tradovate trades are now in the database. Head to Trade View or Dashboard to see them.
          </div>
          <button className="btn btn-p" onClick={reset}>Import More</button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    const dups  = parsed.filter(t => t.duplicate).length
    const total = parsed.length
    const groupCounts: Record<string, number> = {}
    parsed.forEach(t => { groupCounts[t.tradeGroupId] = (groupCounts[t.tradeGroupId] || 0) + 1 })
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
                {['Contract', 'Side', 'Date', 'Contracts', 'Entry', 'Exit', 'P&L', 'Status'].map(h => (
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
                  <td style={{ padding: '8px 12px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>
                    {t.symbol}
                    {groupCounts[t.tradeGroupId] > 1 && <span style={{ marginLeft: '6px', fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '1px 6px' }}>scaled</span>}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--brd)' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: t.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)', color: t.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>{t.type}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)' }}>{new Date(t.date).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.shares}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>${t.entry.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>${t.exit.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                    {t.pointValueUnknown && <span title="Unrecognized futures contract and no Notional Value in the file to derive it — P&L may be inaccurate, verify before importing" style={{ marginLeft: '5px', fontSize: '10px' }}>⚠️</span>}
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
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Import from Tradovate</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '18px' }}>
          Export your Orders CSV from Tradovate and upload it here. Only filled orders are
          imported. Point values are read directly from the file's Notional Value where
          available, so P&amp;L should be accurate even for less common contracts.
        </div>

        <div
          onClick={() => document.getElementById('tradovate-file-input')?.click()}
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
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Drop your Tradovate Orders CSV here</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>or click to browse</div>
          <input id="tradovate-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
        </div>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '8px' }}>How to export from Tradovate:</div>
          {[
            'Open the Orders tab in Tradovate',
            'Set your date range',
            'Click the export/download icon on the Orders grid',
            'Upload the CSV file above',
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ac)', minWidth: '16px' }}>{i + 1}.</span>
              <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{s}</span>
            </div>
          ))}
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
