'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'
import { parseIBKR, type ParsedIbkrTrade as ParsedTrade } from '@/lib/ibkrParser'
import { createClient } from '@/lib/supabase/client'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

export function IbkrImport({ userId, existingTrades, onImported }: Props) {
  const [step,      setStep]      = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsed,    setParsed]    = useState<ParsedTrade[]>([])
  const [selected,  setSelected]  = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [imported,  setImported]  = useState(0)
  const [error,     setError]     = useState('')
  const [notice,    setNotice]    = useState('')
  const [dragOver,  setDragOver]  = useState(false)

  function handleFile(file: File | undefined) {
    if (!file) return
    setError('')
    setNotice('')
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const text = ev.target?.result as string
        const { trades, carriedForward } = await parseIBKR(text, existingTrades, userId, createClient())

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
    if (selected.size === parsed.length) setSelected(new Set())
    else setSelected(new Set(parsed.map((_, i) => i)))
  }

  async function handleImport() {
    setImporting(true)
    const toImport = parsed.filter((_, i) => selected.has(i))
    let count = 0
    for (const t of toImport) {
      const inserted = await insertTrade({
        symbol: t.symbol, asset_type: t.assetType, type: t.type, date: t.date, exit_date: t.exitDate,
        entry: t.entry, exit: t.exit, shares: t.shares, pnl: t.pnl,
        risk: 0, commission: t.commission, setup: null, grade: null,
        tags: [], notes: null, screenshot_url: null,
        trade_group_id: t.tradeGroupId,
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
    setImported(0); setError(''); setNotice('')
  }

  function formatHold(mins: number) {
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
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
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{imported} trade{imported !== 1 ? 's' : ''} imported!</div>
          <div style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '24px' }}>Your Interactive Brokers trades are now in your journal.</div>
          <button className="btn btn-p" onClick={reset}>Import More</button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    const dups = parsed.filter(t => t.duplicate).length
    return (
      <div style={{ padding: '8px' }}>
        <div style={card}>
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
                  <tr key={i} onClick={() => toggleSelect(i)} style={{ cursor: 'pointer', opacity: selected.has(i) ? 1 : 0.4 }}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--brd)' }}>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.symbol}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--brd)' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: t.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)', color: t.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>{t.type}</span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--txt2)', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{new Date(t.date).toLocaleDateString()}</td>
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
      </div>
    )
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={card}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Interactive Brokers — Import CSV</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '18px' }}>
          Upload your IBKR Activity Statement. Trades are previewed before anything is saved.
        </div>

        <div
          onClick={() => document.getElementById('ibkr-file-input')?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--ac)' : 'var(--brd2)'}`,
            borderRadius: 'var(--r2)', padding: '34px',
            textAlign: 'center', cursor: 'pointer',
            marginBottom: '14px', transition: '.15s',
          }}
        >
          <div style={{ fontSize: '24px', color: 'var(--txt3)', marginBottom: '6px' }}>⇪</div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Drop your IBKR Activity Statement here</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>or click to browse</div>
          <input id="ibkr-file-input" type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
        </div>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '8px' }}>How to export from Interactive Brokers:</div>
          {['Log in to IBKR Client Portal', 'Go to Performance & Reports → Statements', 'Click Activity Statement → select your date range', 'Download as CSV', 'Upload the file above'].map((s, i) => (
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
