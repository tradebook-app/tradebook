'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { insertTrade } from '@/lib/tradeService'
import { fetchOpenLegs, replaceOpenLeg } from '@/lib/legMatcher'
import { OPTION_MULTIPLIER } from '@/lib/contractMultiplier'

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
  exitDate: string
  shares: number
  pnl: number
  entryTime: string
  exitTime: string
  holdMinutes: number
  commission: number
  duplicate: boolean
  tradeGroupId: string
  assetType: TradeRow['asset_type']
  assetTypeGuessed: boolean
}

function newGroupId(): string {
  return (globalThis.crypto as any)?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function parseTOS(text: string, existingTrades: TradeRow[], userId: string): Promise<{ trades: ParsedTrade[]; carriedForward: { symbol: string; side: string; qty: number }[] }> {
  const lines = text.split('\n').map(l => l.trim())

  const sectionIdx = lines.findIndex(l => l.includes('Account Trade History'))
  if (sectionIdx === -1) throw new Error('Could not find "Account Trade History" section. Make sure you exported an Account Statement from ThinkOrSwim.')

  const headerIdx = lines.findIndex((l, i) => i > sectionIdx && l.toLowerCase().includes('exec time'))
  if (headerIdx === -1) throw new Error('Could not find trade history header row.')

  const rawHeader = lines[headerIdx]
  const headers = rawHeader.split(',').map(h => h.trim().replace(/^,/, '').toLowerCase())

  const col = (name: string) => headers.findIndex(h => h.includes(name))
  const timeCol   = col('exec time')
  const sideCol   = col('side')
  const qtyCol    = col('qty')
  const symCol    = col('symbol')
  const priceCol  = col('price')
  const typeCol   = col('type')        // CALL / PUT — blank for stock rows
  const posEffCol = col('pos effect')  // TO OPEN / TO CLOSE

  if (symCol === -1 || timeCol === -1) throw new Error('Unexpected column format in Account Trade History.')

  type Execution = {
    datetime: Date
    symbol: string
    side: 'BUY' | 'SELL'
    qty: number
    price: number
    isOption: boolean
    posEffect: string  // 'OPEN' | 'CLOSE' | '' (unknown — falls back to side-flip inference)
  }

  const executions: Execution[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.startsWith('Profits') || line.startsWith('Account Summary') || line.startsWith('Symbol,')) break

    const cols = line.split(',').map(c => c.trim().replace(/"/g, '').replace(/=/g, '').replace(/\$/g, ''))

    const rawTime  = cols[timeCol] || ''
    const side     = (cols[sideCol] || '').toUpperCase()
    const qtyRaw   = cols[qtyCol] || ''
    const symbol   = (cols[symCol] || '').toUpperCase().replace(/[^A-Z]/g, '')
    const price    = parseFloat(cols[priceCol]) || 0
    const rawType  = typeCol !== -1 ? (cols[typeCol] || '').toUpperCase() : ''
    const rawPosEff = posEffCol !== -1 ? (cols[posEffCol] || '').toUpperCase() : ''

    if (!symbol || !rawTime || (!side.includes('BUY') && !side.includes('SELL'))) continue

    const dt = new Date(rawTime)
    if (isNaN(dt.getTime())) continue

    const qty = Math.abs(parseFloat(qtyRaw.replace(/[^0-9.]/g, ''))) || 0

    executions.push({
      datetime: dt,
      symbol,
      side: side.includes('BUY') ? 'BUY' : 'SELL',
      qty,
      price,
      isOption: rawType === 'CALL' || rawType === 'PUT',
      posEffect: rawPosEff.includes('CLOSE') ? 'CLOSE' : rawPosEff.includes('OPEN') ? 'OPEN' : '',
    })
  }

  if (executions.length === 0) throw new Error('No trade executions found. Make sure your file contains Account Trade History data.')

  executions.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

  const existingSigs = new Set(
    existingTrades.map(t => `${t.symbol}-${t.date?.substring(0, 10)}-${t.pnl}`)
  )

  type OpenPosition = {
    side: 'Long' | 'Short'
    entries: { qty: number; price: number; datetime: Date }[]
    remainingQty: number
    tradeGroupId: string
  }

  const trades: ParsedTrade[] = []
  const positions: Record<string, OpenPosition | null> = {}
  const consumedLegIds: Record<string, string[]> = {}

  const symbolsInFile = [...new Set(executions.map(e => e.symbol))]
  const storedLegsBySymbol = await fetchOpenLegs(userId, symbolsInFile)

  for (const symbol of symbolsInFile) {
    const legs = storedLegsBySymbol[symbol]
    if (!legs || legs.length === 0) continue
    const totalQty  = legs.reduce((s, l) => s + l.qty, 0)
    const totalCost = legs.reduce((s, l) => s + l.qty * l.price, 0)
    const earliest  = legs.map(l => new Date(l.opened_at)).sort((a, b) => a.getTime() - b.getTime())[0]
    positions[symbol] = {
      side: legs[0].side as 'Long' | 'Short',
      entries: [{ qty: totalQty, price: totalCost / totalQty, datetime: earliest }],
      remainingQty: totalQty,
      tradeGroupId: legs.find(l => l.trade_group_id)?.trade_group_id || newGroupId(),
    }
    consumedLegIds[symbol] = legs.map(l => l.id)
  }

  for (const exec of executions) {
    const { symbol, side, qty, price, datetime, isOption, posEffect } = exec
    const isBuy = side === 'BUY'

    if (!positions[symbol]) {
      positions[symbol] = {
        side: isBuy ? 'Long' : 'Short',
        entries: [{ qty, price, datetime }],
        remainingQty: qty,
        tradeGroupId: newGroupId(),
      }
    } else {
      const pos = positions[symbol]!
      // Prefer TOS's own Pos Effect column when present — it's unambiguous.
      // Fall back to inferring from a side flip only when that column is missing
      // (some TOS export configurations omit it).
      const isClosing = posEffect
        ? posEffect === 'CLOSE'
        : (pos.side === 'Long' && !isBuy) || (pos.side === 'Short' && isBuy)

      if (isClosing) {
        const totalEntryShares = pos.entries.reduce((s, e) => s + e.qty, 0)
        const totalEntryCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
        const avgEntry = totalEntryCost / totalEntryShares
        const tradeQty  = Math.min(qty, pos.remainingQty)
        const mult = isOption ? OPTION_MULTIPLIER : 1
        const rawPnl = pos.side === 'Long'
          ? (price - avgEntry) * tradeQty * mult
          : (avgEntry - price) * tradeQty * mult

        const entryDatetime = pos.entries[0].datetime
        const holdMinutes   = Math.round((datetime.getTime() - entryDatetime.getTime()) / 60000)
        const dateStr       = entryDatetime.toISOString()
        const pnl           = parseFloat(rawPnl.toFixed(2))
        const sig           = `${symbol}-${dateStr.substring(0, 10)}-${pnl}`

        trades.push({
          symbol,
          type: pos.side,
          date: dateStr,
          entry: parseFloat(avgEntry.toFixed(4)),
          exit: parseFloat(price.toFixed(4)),
          exitDate: datetime.toISOString(),
          shares: tradeQty,
          pnl,
          entryTime: entryDatetime.toLocaleTimeString(),
          exitTime: datetime.toLocaleTimeString(),
          holdMinutes,
          commission: 0,
          duplicate: existingSigs.has(sig),
          tradeGroupId: pos.tradeGroupId,
          assetType: isOption ? 'option' : 'stock',
          assetTypeGuessed: false,
        })

        pos.remainingQty -= tradeQty
        if (pos.remainingQty <= 0) positions[symbol] = null
      } else {
        pos.entries.push({ qty, price, datetime })
        pos.remainingQty += qty
      }
    }
  }

  const carriedForward: { symbol: string; side: string; qty: number }[] = []

  for (const symbol of symbolsInFile) {
    const pos = positions[symbol]
    const consumed = consumedLegIds[symbol] || []

    if (pos && pos.remainingQty > 0) {
      const totalShares = pos.entries.reduce((s, e) => s + e.qty, 0)
      const totalCost   = pos.entries.reduce((s, e) => s + e.qty * e.price, 0)
      const earliest    = pos.entries[0].datetime

      await replaceOpenLeg(userId, symbol, consumed, {
        symbol, side: pos.side, qty: pos.remainingQty,
        price: totalCost / totalShares, opened_at: earliest.toISOString(),
        commission: 0,
        trade_group_id: pos.tradeGroupId,
      }, 'TOS')

      carriedForward.push({ symbol, side: pos.side, qty: pos.remainingQty })
    } else if (consumed.length > 0) {
      await replaceOpenLeg(userId, symbol, consumed, null, 'TOS')
    }
  }

  return { trades, carriedForward }
}

export function TosImport({ userId, existingTrades, onImported }: Props) {
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
        const { trades, carriedForward } = await parseTOS(text, existingTrades, userId)

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
          <div style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '24px' }}>Your ThinkOrSwim trades are now in your journal.</div>
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
                      {t.assetTypeGuessed && <span title="Detected as an option from the symbol format — verify before importing" style={{ marginLeft: '5px', fontSize: '10px' }}>⚠️</span>}
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
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>ThinkOrSwim — Import CSV</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '18px' }}>
          Upload your TOS Account Statement. Trades are previewed before anything is saved.
        </div>

        <div
          onClick={() => document.getElementById('tos-file-input')?.click()}
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
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Drop your TOS Account Statement here</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>or click to browse</div>
          <input id="tos-file-input" type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
        </div>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '8px' }}>How to export from ThinkOrSwim:</div>
          {['Open ThinkOrSwim platform', 'Go to Monitor → Account Statement', 'Select your date range', 'Click the export icon (top right) → Save as CSV', 'Upload the file above'].map((s, i) => (
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
