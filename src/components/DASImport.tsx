'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'

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
  shares:    number
  pnl:       number
  duplicate: boolean
}

export function DASImport({ userId, existingTrades, onImported }: Props) {
  const [step,     setStep]     = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsed,   setParsed]   = useState<ParsedTrade[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing,setImporting]= useState(false)
  const [imported, setImported] = useState(0)
  const [error,    setError]    = useState('')

  function parseCSV(text: string): ParsedTrade[] {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('File appears empty')

    // Find header line
    const headerIdx = lines.findIndex(l =>
      l.toLowerCase().includes('symbol') || l.toLowerCase().includes('time')
    )
    if (headerIdx === -1) throw new Error('Could not find header row. Make sure this is a DAS Trader export.')

    const headers = lines[headerIdx].split('\t').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    const rows    = lines.slice(headerIdx + 1)

    // Column mappings (DAS Trader uses various column names)
    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.findIndex(h => h.includes(n))
        if (i >= 0) return i
      }
      return -1
    }

    const symCol    = col(['sym', 'symbol', 'ticker'])
    const sideCol   = col(['side', 'buysell', 'action'])
    const sharesCol = col(['qty', 'shares', 'size', 'quant'])
    const priceCol  = col(['price', 'avgprice', 'avgcost'])
    const plCol     = col(['pnl', 'pl', 'profit', 'loss', 'netpnl'])
    const timeCol   = col(['time', 'date', 'datetime'])

    if (symCol < 0) throw new Error('Symbol column not found. Check file format.')

    // Build existing trade signatures for duplicate detection
    const existingSigs = new Set(
      existingTrades.map(t =>
        `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`
      )
    )

    // Group fills by symbol+date for partial fill collapsing
    const groups: Record<string, {
      symbol: string; side: string; date: string
      totalShares: number; totalCost: number; pnl: number
    }> = {}

    rows.forEach(row => {
      if (!row.trim()) return
      const cols = row.split('\t').map(c => c.trim().replace(/"/g, ''))

      const symbol = symCol >= 0 ? cols[symCol]?.toUpperCase() : ''
      if (!symbol) return

      const side   = sideCol   >= 0 ? cols[sideCol]   : 'B'
      const shares = sharesCol >= 0 ? parseFloat(cols[sharesCol]) || 0 : 0
      const price  = priceCol  >= 0 ? parseFloat(cols[priceCol])  || 0 : 0
      const pnl    = plCol     >= 0 ? parseFloat(cols[plCol])     || 0 : 0
      const rawTime = timeCol  >= 0 ? cols[timeCol] : ''

      // Parse date
      let dateStr = new Date().toISOString()
      if (rawTime) {
        const d = new Date(rawTime)
        if (!isNaN(d.getTime())) dateStr = d.toISOString()
      }

      const dateKey = dateStr.substring(0, 10)
      const key     = `${symbol}-${dateKey}-${side}`

      if (!groups[key]) {
        groups[key] = { symbol, side, date: dateStr, totalShares: 0, totalCost: 0, pnl: 0 }
      }
      groups[key].totalShares += shares
      groups[key].totalCost   += price * shares
      groups[key].pnl         += pnl
    })

    return Object.values(groups).map(g => {
      const avgPrice = g.totalShares > 0 ? g.totalCost / g.totalShares : 0
      const isBuy    = g.side.toLowerCase().startsWith('b')
      const type: 'Long' | 'Short' = isBuy ? 'Long' : 'Short'

      const sig = `${g.symbol}-${g.date.substring(0, 10)}-${g.pnl}`

      return {
        symbol:    g.symbol,
        type,
        date:      g.date,
        entry:     parseFloat(avgPrice.toFixed(4)),
        exit:      0,
        shares:    g.totalShares,
        pnl:       parseFloat(g.pnl.toFixed(2)),
        duplicate: existingSigs.has(sig),
      }
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text   = ev.target?.result as string
        const trades = parseCSV(text)
        setParsed(trades)
        // Pre-select all non-duplicates
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
        symbol:        t.symbol,
        type:          t.type,
        date:          t.date,
        exit_date:     null,
        entry:         t.entry,
        exit:          null,
        shares:        t.shares,
        pnl:           t.pnl,
        risk:          0,
        commission:    0,
        setup:         null,
        grade:         null,
        tags:          [],
        notes:         'Imported from DAS Trader',
        screenshot_url: null,
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
    setImported(0); setError('')
  }

  if (step === 'done') {
    return (
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--brd)',
        borderRadius: 'var(--r2)', padding: '48px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
          {imported} trade{imported !== 1 ? 's' : ''} imported!
        </div>
        <div style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '24px' }}>
          Your trades are now in the database. Head to Trade View or Dashboard to see them.
        </div>
        <button className="btn btn-p" onClick={reset}>Import More</button>
      </div>
    )
  }

  if (step === 'preview') {
    const dups  = parsed.filter(t => t.duplicate).length
    const total = parsed.length

    return (
      <div>
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
                {['Symbol','Side','Date','Shares','Entry Avg','P&L','Status'].map(h => (
                  <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
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
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: t.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)', color: t.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>{t.type}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)' }}>{new Date(t.date).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.shares}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>${t.entry}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>
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

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Import from DAS Trader Pro</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', lineHeight: 1.6 }}>
          Export your trades from DAS Trader as a CSV/TSV file and upload it here.
          Partial fills are automatically collapsed into single trades. Duplicates are detected automatically.
        </div>
      </div>

      {/* How to export instructions */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '10px' }}>How to export from DAS Trader Pro:</div>
        {[
          'Open DAS Trader Pro',
          'Go to Trade → Trade Report (or press Ctrl+Alt+T)',
          'Select your date range',
          'Click Export → Save as CSV or Tab-delimited text',
          'Upload the file below',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ac)', minWidth: '16px' }}>{i + 1}.</span>
            <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{step}</span>
          </div>
        ))}
      </div>

      {/* Upload area */}
      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: '40px',
        background: 'var(--bg3)', border: '2px dashed var(--brd2)',
        borderRadius: 'var(--r2)', cursor: 'pointer',
        transition: '.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ac)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brd2)')}
      >
        <input
          type="file"
          accept=".csv,.txt,.tsv,.log"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <div style={{ fontSize: '28px' }}>📂</div>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Click to upload DAS export file</div>
        <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>Supports .csv, .txt, .tsv (tab-delimited)</div>
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
    </div>
  )
}
