'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

type ParsedTrade = {
  symbol: string
  type: 'Long' | 'Short'
  date: string
  entry: number
  exit: number
  shares: number
  pnl: number
  entryTime: string
  exitTime: string
  holdMinutes: number
  commission: number
  duplicate: boolean
}

function parseIBKR(text: string, existingTrades: TradeRow[]): ParsedTrade[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  type Execution = {
    datetime: Date
    symbol: string
    qty: number        // positive = buy, negative = sell
    price: number
    commission: number
    code: string       // O = open, C = close
    realizedPnl: number
  }

  const executions: Execution[] = []

  for (const line of lines) {
    // Only process trade data rows
    if (!line.startsWith('Trades,Data,Order,Stocks,')) continue

    // Parse CSV respecting quoted fields
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

    // Columns: 0=Trades,1=Data,2=Order,3=Stocks,4=USD,5=Symbol,6=DateTime,7=Qty,8=T.Price,9=C.Price,10=Proceeds,11=Comm,12=Basis,13=RealizedPnL,14=MTM,15=Code
    const symbol     = (cols[5] || '').toUpperCase().trim()
    const rawTime    = cols[6] || ''
    const qty        = parseFloat(cols[7]) || 0
    const price      = parseFloat(cols[8]) || 0
    const commission = Math.abs(parseFloat(cols[11]) || 0)
    const realizedPnl = parseFloat(cols[13]) || 0
    const code       = (cols[15] || '').toUpperCase()

    if (!symbol || !rawTime || qty === 0) continue

    const dt = new Date(rawTime)
    if (isNaN(dt.getTime())) continue

    executions.push({ datetime: dt, symbol, qty, price, commission, code, realizedPnl })
  }

  if (executions.length === 0) {
    throw new Error('No trade executions found. Make sure this is an IBKR Activity Statement with trade data.')
  }

  // Sort by time
  executions.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

  const existingSigs = new Set(
    existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
  )

  // Match opens to closes per symbol
  type OpenPos = {
    entries: { qty: number; price: number; datetime: Date; commission: number }[]
    remainingQty: number
    side: 'Long' | 'Short'
  }

  const positions: Record<string, OpenPos | null> = {}
  const trades: ParsedTrade[] = []

  for (const exec of executions) {
    const { symbol, qty, price, datetime, commission, realizedPnl } = exec
    const isBuy = qty > 0
    const absQty = Math.abs(qty)

    if (!positions[symbol]) {
      // New position
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
        // Calculate weighted avg entry
        const totalShares = pos.entries.reduce((s, e) => s + e.qty, 0)
        const totalCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
        const avgEntry    = totalCost / totalShares
        const totalComm   = pos.entries.reduce((s, e) => s + e.commission, 0) + commission
        const tradeQty    = Math.min(absQty, pos.remainingQty)

        const entryDatetime = pos.entries[0].datetime
        const holdMinutes   = Math.round((datetime.getTime() - entryDatetime.getTime()) / 60000)
        const dateStr       = entryDatetime.toISOString()

        // Use IBKR's realized P&L directly — it's accurate
        const pnl = parseFloat(realizedPnl.toFixed(2))
        const sig = `${symbol}-${dateStr.substring(0, 10)}-${pnl}`

        trades.push({
          symbol,
          type: pos.side,
          date: dateStr,
          entry: parseFloat(avgEntry.toFixed(4)),
          exit: parseFloat(price.toFixed(4)),
          shares: tradeQty,
          pnl,
          entryTime: entryDatetime.toLocaleTimeString(),
          exitTime: datetime.toLocaleTimeString(),
          holdMinutes,
          commission: parseFloat(totalComm.toFixed(2)),
          duplicate: existingSigs.has(sig),
        })

        pos.remainingQty -= tradeQty
        if (pos.remainingQty <= 0) {
          positions[symbol] = null
        }
      } else {
        // Adding to position
        pos.entries.push({ qty: absQty, price, datetime, commission })
        pos.remainingQty += absQty
      }
    }
  }

  if (trades.length === 0) {
    throw new Error('No complete trades found. Make sure your Activity Statement contains both opening and closing trades.')
  }

  return trades
}

export function IbkrImport({ userId, existingTrades, onImported }: Props) {
  const [step,      setStep]      = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsed,    setParsed]    = useState<ParsedTrade[]>([])
  const [selected,  setSelected]  = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [imported,  setImported]  = useState(0)
  const [error,     setError]     = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text   = ev.target?.result as string
        const trades = parseIBKR(text, existingTrades)
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
    if (selected.size === parsed.length) setSelected(new Set())
    else setSelected(new Set(parsed.map((_, i) => i)))
  }

  async function handleImport() {
    setImporting(true)
    const toImport = parsed.filter((_, i) => selected.has(i))
    let count = 0
    for (const t of toImport) {
      const inserted = await insertTrade({
        symbol:         t.symbol,
        type:           t.type,
        date:           t.date,
        exit_date:      null,
        entry:          t.entry,
        exit:           t.exit,
        shares:         t.shares,
        pnl:            t.pnl,
        risk:           0,
        commission:     t.commission,
        setup:          null,
        grade:          null,
        tags:           [],
        notes:          'Imported from Interactive Brokers',
        screenshot_url: null,
      }, userId)
      if (inserted) count++
    }
    setImported(count)
    onImported()
    setStep('done')
    setImporting(false)
  }

  function reset() {
    setStep('upload'); setParsed([]); setSelected(new Set())
    setImported(0); setError('')
  }

  function formatHold(mins: number) {
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  if (step === 'done') {
    return (
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{imported} trade{imported !== 1 ? 's' : ''} imported!</div>
        <div style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '24px' }}>Your Interactive Brokers trades are now in your journal.</div>
        <button className="btn btn-p" onClick={reset}>Import More</button>
      </div>
    )
  }

  if (step === 'preview') {
    const dups = parsed.filter(t => t.duplicate).length
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <button className="btn btn-o" onClick={reset}>← Back</button>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>
            Preview — {parsed.length} trade{parsed.length !== 1 ? 's' : ''} found
            {dups > 0 && <span style={{ fontSize: '10px', color: 'var(--orange)', marginLeft: '8px' }}>· {dups} possible duplicate{dups !== 1 ? 's' : ''}</span>}
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
                {['Symbol','Side','Date','Shares','Entry','Exit','Hold','P&L','Status'].map(h => (
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
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: '11px', borderBottom: '1px solid var(--brd)' }}>{t.shares}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: '11px', borderBottom: '1px solid var(--brd)' }}>${t.entry}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: '11px', borderBottom: '1px solid var(--brd)' }}>${t.exit}</td>
                  <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--txt3)', borderBottom: '1px solid var(--brd)' }}>{formatHold(t.holdMinutes)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--brd)' }}>
                    {t.duplicate
                      ? <span style={{ fontSize: '9px', color: 'var(--orange)', background: 'rgba(245,158,11,.1)', padding: '2px 6px', borderRadius: '3px' }}>Duplicate</span>
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

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Import from Interactive Brokers</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', lineHeight: 1.6 }}>
          Export your Activity Statement from IBKR and upload it here. Sleektrade automatically parses your trades, entry/exit prices, hold time, and P&L.
        </div>
      </div>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '10px' }}>How to export from Interactive Brokers:</div>
        {[
          'Log in to IBKR Client Portal',
          'Go to Performance & Reports → Statements',
          'Click Activity Statement → select your date range',
          'Download as CSV',
          'Upload the file below',
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ac)', minWidth: '16px' }}>{i + 1}.</span>
            <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{s}</span>
          </div>
        ))}
      </div>

      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: '40px',
        background: 'var(--bg3)', border: '2px dashed var(--brd2)',
        borderRadius: 'var(--r2)', cursor: 'pointer', transition: '.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ac)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brd2)')}
      >
        <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
        <div style={{ fontSize: '28px' }}>📂</div>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Click to upload IBKR Activity Statement</div>
        <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>Supports .csv files exported from Interactive Brokers</div>
      </label>

      {error && (
        <div style={{ marginTop: '12px', background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: 'var(--red)' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
