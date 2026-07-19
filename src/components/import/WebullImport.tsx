'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'
import { createClient } from '@/lib/supabase/client'
import { matchWebullExecutions, type WebullExecution } from '@/lib/webullMatcher'

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
  commission: number
  duplicate: boolean
  tradeGroupId: string
  assetType: TradeRow['asset_type']
  assetTypeGuessed: boolean
}

export function WebullImport({ userId, existingTrades, onImported }: Props) {
  const [step,      setStep]      = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsed,    setParsed]    = useState<ParsedTrade[]>([])
  const [selected,  setSelected]  = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [imported,  setImported]  = useState(0)
  const [error,     setError]     = useState('')
  const [notice,    setNotice]    = useState('')
  const [dragOver,  setDragOver]  = useState(false)

  // Webull's export headers are fixed and known (verified against a real Order
  // History export — both the desktop .xlsx and the .csv variant use the same
  // header names). We match on exact header names in priority order, never on
  // keyword-guessing — keyword matching previously collided badly with headers
  // like "Total Qty" (matched before "Filled Qty"), "Stop Price" (matched before
  // "Filled Price"), and "User ID" (matched as an order id, merging every trade
  // in the file into one giant group).
  function getField(row: Record<string, any>, names: string[]): string {
    for (const n of names) {
      if (row[n] !== undefined && row[n] !== null && String(row[n]).trim() !== '') {
        return String(row[n]).trim()
      }
    }
    return ''
  }

  async function parseWorkbook(rows: Record<string, any>[]): Promise<{ trades: ParsedTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
    if (rows.length === 0) throw new Error('File appears empty')

    const firstRow = rows[0]
    const hasExpectedHeaders = 'Symbol' in firstRow && 'Side' in firstRow && 'Filled Qty' in firstRow
    if (!hasExpectedHeaders) {
      throw new Error("This doesn't look like a Webull order history export. Make sure you're uploading the file from Account → Orders → Order History.")
    }

    const executions: WebullExecution[] = []
    const tickerTypeBySymbol: Record<string, string> = {}

    for (const row of rows) {
      // Only fully filled orders represent real executions — cancelled/working/
      // rejected orders still show a nonzero "Total Qty" but a zero "Filled Qty",
      // which is exactly the case that broke the old parser.
      const status = getField(row, ['Execute Status', 'Status']).toUpperCase()
      if (status && status !== 'FILLED') continue

      const symbol = getField(row, ['Symbol']).toUpperCase()
      if (!symbol) continue

      const sideRaw = getField(row, ['Side']).toUpperCase()
      if (!sideRaw) continue
      const isBuy = sideRaw.startsWith('B')

      const qty = parseFloat(getField(row, ['Filled Qty', 'Total Qty'])) || 0
      if (qty <= 0) continue

      const price = parseFloat(getField(row, ['Filled Price', 'Average Price'])) || 0
      if (price <= 0) continue

      const dateRaw = getField(row, ['Filled Time', 'Create Time', 'Placed Time'])
      const date = dateRaw ? new Date(dateRaw) : null
      if (!date || isNaN(date.getTime())) continue

      // Webull's export states the instrument type explicitly — no need to guess
      // from the symbol format the way IBKR/TOS importers have to.
      const tickerType = getField(row, ['Ticker Type'])
      if (tickerType) tickerTypeBySymbol[symbol] = tickerType.toUpperCase()

      executions.push({ symbol, isBuy, qty, price, date, commission: 0 })
    }

    if (executions.length === 0) {
      throw new Error('No filled orders found in this file.')
    }

    // Reuse the exact same chronological position-matching logic the Webull
    // auto-sync path uses, so manual import and auto-sync always agree.
    const supabase = createClient()
    const { trades: matched, carriedForward } = await matchWebullExecutions(
      executions, existingTrades, userId, supabase
    )

    const trades: ParsedTrade[] = matched.map(t => {
      const knownType = tickerTypeBySymbol[t.symbol]
      let assetType = t.assetType
      let assetTypeGuessed = t.assetTypeGuessed
      if (knownType) {
        if (knownType.includes('OPTION')) { assetType = 'option'; assetTypeGuessed = false }
        else if (knownType.includes('EQUITY') || knownType.includes('STOCK')) { assetType = 'stock'; assetTypeGuessed = false }
      }
      return { ...t, assetType, assetTypeGuessed }
    })

    return { trades, carriedForward }
  }

  function processFile(file: File | undefined) {
    if (!file) return
    setError('')
    setNotice('')

    const isCsvLike = /\.(csv|txt|tsv)$/i.test(file.name)
    const reader = new FileReader()

    reader.onload = async ev => {
      try {
        let rows: Record<string, any>[]

        if (isCsvLike) {
          const text = ev.target?.result as string
          const wb = XLSX.read(text, { type: 'string' })
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
        } else {
          const data = ev.target?.result as ArrayBuffer
          const wb = XLSX.read(data, { type: 'array' })
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
        }

        const { trades, carriedForward } = await parseWorkbook(rows)

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

    if (isCsvLike) reader.readAsText(file)
    else reader.readAsArrayBuffer(file)
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

  const card: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--brd)',
    borderRadius: 'var(--r2)', padding: '20px',
    maxWidth: '640px', margin: '0 auto',
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ padding: '8px' }}>
        <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
            {imported} trade{imported !== 1 ? 's' : ''} imported!
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '24px' }}>
            Your Webull trades are now in the database. Head to Trade View or Dashboard to see them.
          </div>
          <button className="btn btn-p" onClick={reset}>Import More</button>
        </div>
      </div>
    )
  }

  // ── Preview screen ───────────────────────────────────────────────────────
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
                  <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--txt2)', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>
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
                    {t.assetTypeGuessed && <span title="Detected as an option from the symbol format — verify before importing" style={{ marginLeft: '5px', fontSize: '10px' }}>⚠️</span>}
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

  // ── Upload screen ────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '8px' }}>
      <div style={card}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Import from Webull</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '18px' }}>
          Export your order history from Webull and upload it here. Only fully filled orders are
          imported. Buy/sell fills are matched chronologically to calculate P&L. Duplicates are
          detected automatically.
        </div>

        <div
          onClick={() => document.getElementById('webull-file-input')?.click()}
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
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Drop your Webull export file here</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>.xlsx or .csv — or click to browse</div>
          <input id="webull-file-input" type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileInput} />
        </div>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '8px' }}>
            How to export from Webull Desktop:
          </div>
          {[
            'Open Webull Desktop',
            'Go to Account → Orders → Order History',
            'Set your date range (max 90 days per export)',
            'Filter by Status: Filled',
            'Click the Export button and save the file',
            'Upload the file above (.xlsx or .csv both work)',
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
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
    </div>
  )
}
