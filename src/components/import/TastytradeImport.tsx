'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'
import { matchTastytradeLegs, type TTLeg, type ParsedTastytradeTrade as ParsedTrade } from '@/lib/tastytradeMatcher'
import { createClient } from '@/lib/supabase/client'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: (trades: TradeRow[]) => void
}

export function TastytradeImport({ userId, existingTrades, onImported }: Props) {
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

    // Find header row
    const headerIdx = lines.findIndex(l =>
      l.toLowerCase().includes('action') && l.toLowerCase().includes('symbol')
    )
    if (headerIdx === -1) throw new Error('Could not find header row. Make sure this is a Tastytrade transaction CSV.')

    const splitRow = (line: string) => {
      // Handle quoted fields with commas inside
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
        else { current += ch }
      }
      result.push(current.trim())
      return result
    }

    const headers = splitRow(lines[headerIdx]).map(h => h.toLowerCase().replace(/[\s#]/g, ''))
    const rows    = lines.slice(headerIdx + 1)

    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.findIndex(h => h.includes(n))
        if (i >= 0) return i
      }
      return -1
    }

    const dateCol    = col(['date'])
    const typeCol    = col(['type'])
    const actionCol  = col(['action'])
    const symCol     = col(['symbol'])
    const valueCol   = col(['value'])
    const qtyCol     = col(['quantity', 'qty'])
    const priceCol   = col(['averageprice', 'avgprice', 'price'])
    const commCol    = col(['commissions', 'commission'])
    const feesCol    = col(['fees', 'fee'])
    const orderCol   = col(['order'])
    const instrumentTypeCol = col(['instrumenttype'])

    if (symCol < 0)    throw new Error('Symbol column not found.')
    if (actionCol < 0) throw new Error('Action column not found.')

    // Group rows by symbol+date, tracking opens and closes
    // Tastytrade Action values:
    //   "Buy to Open"    → Long entry
    //   "Sell to Close"  → Long exit
    //   "Sell to Open"   → Short entry
    //   "Buy to Close"   → Short exit

    // Group by symbol+date (or order# if available)
    const rawLegs: TTLeg[] = []

    rows.forEach(row => {
      if (!row.trim()) return
      const cols = splitRow(row)

      // Only process Trade type rows
      const rowType = typeCol >= 0 ? cols[typeCol]?.trim().toLowerCase() : ''
      if (rowType && rowType !== 'trade') return

      const symbol = symCol >= 0 ? cols[symCol]?.trim().toUpperCase() : ''
      if (!symbol) return

      const action = actionCol >= 0 ? cols[actionCol]?.trim() : ''
      const qty    = qtyCol    >= 0 ? Math.abs(parseFloat(cols[qtyCol])    || 0) : 0
      const price  = priceCol  >= 0 ? Math.abs(parseFloat(cols[priceCol])  || 0) : 0
      const comm   = commCol   >= 0 ? Math.abs(parseFloat(cols[commCol])   || 0) : 0
      const fees   = feesCol   >= 0 ? Math.abs(parseFloat(cols[feesCol])   || 0) : 0

      let dateStr = new Date().toISOString()
      if (dateCol >= 0 && cols[dateCol]) {
        const d = new Date(cols[dateCol])
        if (!isNaN(d.getTime())) dateStr = d.toISOString()
      }

      const dateKey = dateStr.substring(0, 10)
      const orderId = orderCol >= 0 ? cols[orderCol]?.trim() : ''
      const groupKey = orderId ? `${symbol}-${orderId}` : `${symbol}-${dateKey}`
      const instrumentType = instrumentTypeCol >= 0 ? (cols[instrumentTypeCol]?.trim() || 'Equity') : 'Equity'

      rawLegs.push({ groupKey, symbol, action, qty, price, date: dateStr, commission: comm + fees, instrumentType })
    })

    const { trades, carriedForward } = await matchTastytradeLegs(rawLegs, existingTrades, userId, createClient())

    if (trades.length === 0 && carriedForward.length === 0) {
      throw new Error('No trades found. Make sure you exported the Transactions tab (not Orders) and the file contains Trade type rows.')
    }

    return { trades, carriedForward }
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
        notes:          'Imported from Tastytrade',
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

  // ── Done ────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '48px', textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
          {imported} trade{imported !== 1 ? 's' : ''} imported!
        </div>
        <div style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '24px' }}>
          Your Tastytrade trades are now in the database. Head to Trade View or Dashboard to see them.
        </div>
        <button className="btn btn-p" onClick={reset}>Import More</button>
      </div>
    )
  }

  // ── Preview ──────────────────────────────────────────────────────────────
  if (step === 'preview') {
    const dups  = parsed.filter(t => t.duplicate).length
    const total = parsed.length

    return (
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
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
                <tr
                  key={i}
                  onClick={() => toggleSelect(i)}
                  style={{ cursor: 'pointer', opacity: selected.has(i) ? 1 : 0.4, background: t.duplicate ? 'rgba(245,158,11,.04)' : 'transparent' }}
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
    )
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Import from Tastytrade</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', lineHeight: 1.6 }}>
          Export your transaction history from Tastytrade and upload it here.
          Commissions and fees are included. Duplicates are detected automatically.
        </div>
      </div>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '10px' }}>How to export from Tastytrade:</div>
        {[
          'Log in to my.tastytrade.com',
          'Go to Activity → Transactions tab',
          'Set your date range and filter by Status: Filled',
          'Click the CSV export icon (top right)',
          'Upload the file below',
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ac)', minWidth: '16px' }}>{i + 1}.</span>
            <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{s}</span>
          </div>
        ))}
        <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--txt3)', background: 'rgba(245,158,11,.08)', borderRadius: 'var(--r)', padding: '8px 12px', borderLeft: '2px solid var(--orange)' }}>
          ⚠️ Export from the <strong>Transactions</strong> tab, not Orders. The file limit is 1,000 rows — use date ranges to split large exports.
        </div>
      </div>

      <div
        onClick={() => document.getElementById('tastytrade-file-input')?.click()}
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
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Drop your Tastytrade export file here</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>or click to browse</div>
        <input id="tastytrade-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
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
  )
}
