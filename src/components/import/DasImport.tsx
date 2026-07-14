'use client'

import { useState } from 'react'
import { insertTrade } from '@/lib/tradeService'
import { fetchOpenLegs, replaceOpenLeg } from '@/lib/legMatcher'
import type { TradeRow, TradeInsert, DASParsedTrade } from '@/lib/types'

function newGroupId(): string {
  return (globalThis.crypto as any)?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER — ported from the original TRADEBOOK. Handles two DAS export shapes:
//   1) Rows that already include a P/L column  → one trade per row
//   2) Raw executions (fills)                  → collapse partial fills by order
//      id, then pair buys/sells into round-trip trades via position tracking
// ─────────────────────────────────────────────────────────────────────────────
async function parseDAS(text: string, userId: string): Promise<{ trades?: DASParsedTrade[]; error?: string; carriedForward?: { symbol: string; side: string; qty: number }[] }> {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { error: 'The file looks empty.' }

  const hds = lines[0]
    .replace(/^\uFEFF/, '')
    .replace(/"/g, '')
    .trim()
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9/]/g, ''))

  if (!hds.some((h) => h.includes('symb') || h.includes('symbol') || h === 'sym')) {
    return { error: 'No "Symbol" column found in the CSV header.' }
  }

  const col = (ns: string[]): number => {
    for (const n of ns) {
      const i = hds.findIndex((h) => h.includes(n))
      if (i !== -1) return i
    }
    return -1
  }

  const iD = col(['date'])
  const iS = col(['symb', 'symbol', 'sym'])
  const iSide = col(['side', 'action'])
  const iP = col(['price', 'execprice', 'avg'])
  const iQ = col(['qty', 'shares', 'quantity', 'size'])
  const iPL = col(['p/l', 'pl', 'pnl', 'net', 'profit'])
  const iC = col(['comm', 'commission', 'fee'])
  const hasPL = hds.some(
    (h) => h.includes('p/l') || h.includes('pl') || h.includes('pnl') || h.includes('net')
  )

  const clean = (s: string): string => (s || '').replace(/"/g, '').trim()

  const splitCSV = (l: string): string[] => {
    const r: string[] = []
    let q = false
    let c = ''
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (ch === '"') q = !q
      else if (ch === ',' && !q) {
        r.push(c)
        c = ''
      } else c += ch
    }
    r.push(c)
    return r
  }

  const pDate = (ds: string): Date => {
    let d = new Date()
    if (ds) {
      const c = ds.trim()
      if (/^\d{4}-\d{2}-\d{2}/.test(c)) {
        d = new Date(c.substring(0, 10))
      } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(c)) {
        const p = c.split('/')
        d = new Date(
          `${p[2].length === 2 ? '20' + p[2] : p[2]}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}`
        )
      } else if (/^\d{8}$/.test(c)) {
        d = new Date(`${c.substring(0, 4)}-${c.substring(4, 6)}-${c.substring(6, 8)}`)
      }
    }
    return isNaN(d.getTime()) ? new Date() : d
  }

  // DAS "Time" exports have no Date column — the date is the YYMMDD prefix of the Cloid/order id
  const dateFromCloid = (cloid: string): Date | null => {
    const digits = (cloid || '').replace(/\D/g, '')
    if (digits.length >= 6) {
      const yy = digits.substring(0, 2)
      const mm = digits.substring(2, 4)
      const dd = digits.substring(4, 6)
      const mo = parseInt(mm, 10), day = parseInt(dd, 10)
      if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
        const d = new Date(`20${yy}-${mm}-${dd}`)
        if (!isNaN(d.getTime())) return d
      }
    }
    return null
  }

  const trades: DASParsedTrade[] = []
  const carriedForward: { symbol: string; side: string; qty: number }[] = []

  if (hasPL && iD !== -1) {
    // ── Mode 1: each row already has a P/L ──
    for (let i = 1; i < lines.length; i++) {
      const c = splitCSV(lines[i])
      if (c.length < 3) continue
      const sym = clean(c[iS]).toUpperCase()
      if (!sym || sym === 'SYMBOL') continue
      const pl = iPL !== -1 ? parseFloat(clean(c[iPL]).replace(/[$,]/g, '')) : 0
      if (isNaN(pl)) continue
      const comm = iC !== -1 ? parseFloat(clean(c[iC]).replace(/[$,]/g, '')) || 0 : 0
      const price = iP !== -1 ? parseFloat(clean(c[iP]).replace(/[$,]/g, '')) : 0
      const qty = iQ !== -1 ? Math.abs(parseFloat(clean(c[iQ]).replace(/,/g, ''))) : 0
      const side = iSide !== -1 ? clean(c[iSide]).toUpperCase() : ''
      trades.push({
        sym,
        date: pDate(clean(c[iD])),
        side: side.startsWith('S') ? 'Short' : 'Long',
        entry: price || 0,
        exit: 0,
        shares: qty || 0,
        pl: pl - Math.abs(comm),
      })
    }
  } else {
    // ── Mode 2: raw executions → pair into round-trip trades ──
    const iTime = col(['time', 'exectime', 'datetime', 'timestamp'])
    const iCloid = col(['cloid', 'orderid', 'order_id', 'clordid', 'ordid'])

    type RawExec = {
      sym: string
      date: Date
      isBuy: boolean
      price: number
      qty: number
      time: number
      cloid: string
    }
    const rawExecs: RawExec[] = []

    for (let i = 1; i < lines.length; i++) {
      const c = splitCSV(lines[i])
      if (c.length < 3) continue
      const sym = clean(c[iS]).toUpperCase()
      if (!sym || sym === 'SYMBOL') continue
      const price = iP !== -1 ? parseFloat(clean(c[iP]).replace(/[$,]/g, '')) : 0
      const qty = iQ !== -1 ? Math.abs(parseFloat(clean(c[iQ]).replace(/,/g, ''))) : 0
      if (!sym || isNaN(price) || qty === 0) continue
      const rs = iSide !== -1 ? clean(c[iSide]).toUpperCase() : ''
      const isBuy = rs === 'B' || (rs.startsWith('B') && rs !== 'SS')
      const timeStr = iTime !== -1 ? clean(c[iTime]) : ''
      const timeVal = timeStr ? new Date('2000/01/01 ' + timeStr).getTime() || i : i
      const cloid = iCloid !== -1 ? clean(c[iCloid]) : ''
      const rowDate = iD !== -1 ? pDate(clean(c[iD])) : (dateFromCloid(cloid) || new Date())
      rawExecs.push({
        sym,
        date: rowDate,
        isBuy,
        price,
        qty,
        time: timeVal,
        cloid,
      })
    }

    // Collapse partial fills: same order id = same order, qty-weighted avg price
    type Order = {
      sym: string
      date: Date
      isBuy: boolean
      time: number
      qty: number
      cost: number
    }
    const orderMap: Record<string, Order> = {}
    rawExecs.forEach((ex, idx) => {
      const k = ex.cloid ? `${ex.cloid}_${ex.sym}_${ex.isBuy}` : `row_${idx}`
      if (!orderMap[k]) {
        orderMap[k] = { sym: ex.sym, date: ex.date, isBuy: ex.isBuy, time: ex.time, qty: 0, cost: 0 }
      }
      orderMap[k].qty += ex.qty
      orderMap[k].cost += ex.price * ex.qty
    })

    type Exec = { sym: string; date: Date; isBuy: boolean; price: number; qty: number; time: number }
    const execs: Exec[] = Object.values(orderMap).map((o) => ({
      sym: o.sym,
      date: o.date,
      isBuy: o.isBuy,
      price: o.cost / o.qty,
      qty: o.qty,
      time: o.time,
    }))

    // Group by symbol only (not day) — positions now track continuously across
    // however many days/exits the file contains, and any position still open at
    // the end of this file is saved so a later import (even on a different day)
    // can pick up right where this one left off.
    type Grp = { sym: string; execs: Exec[] }
    const groups: Record<string, Grp> = {}
    execs.forEach((ex) => {
      if (!groups[ex.sym]) groups[ex.sym] = { sym: ex.sym, execs: [] }
      groups[ex.sym].execs.push(ex)
    })

    const symbolsInFile = Object.keys(groups)
    const storedLegsBySymbol = await fetchOpenLegs(userId, symbolsInFile)

    for (const g of Object.values(groups)) {
      // Chronological sort: real calendar date first, then intraday fill order
      const sorted = g.execs.slice().sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime()
        return dateDiff !== 0 ? dateDiff : a.time - b.time
      })

      const storedLegs = storedLegsBySymbol[g.sym] || []
      const consumedIds = storedLegs.map((l) => l.id)

      let pos = 0
      let tripSide: 'Long' | 'Short' | null = null
      let tripShares = 0
      let tripCost = 0
      let tripCloseShares = 0
      let tripCloseCost = 0
      let tripEntryDate: Date | undefined
      let tripEntryTime: number | undefined
      let tripExitTime: number | undefined
      let tripGroupId = ''

      // Seed with a position carried forward from a previous import, if one exists
      if (storedLegs.length > 0) {
        const totalQty = storedLegs.reduce((s, l) => s + l.qty, 0)
        const totalCost = storedLegs.reduce((s, l) => s + l.qty * l.price, 0)
        const earliest = storedLegs.map((l) => new Date(l.opened_at)).sort((a, b) => a.getTime() - b.getTime())[0]
        tripSide = storedLegs[0].side as 'Long' | 'Short'
        tripShares = totalQty
        tripCost = totalCost
        tripEntryDate = earliest
        tripGroupId = storedLegs.find((l) => l.trade_group_id)?.trade_group_id || newGroupId()
        pos = tripSide === 'Long' ? totalQty : -totalQty
      }

      const flushClose = () => {
        const side = tripSide
        if (side && tripShares > 0 && tripCloseShares > 0) {
          const avgEntry = tripCost / tripShares
          const avgExit = tripCloseCost / tripCloseShares
          const mQ = Math.min(tripShares, tripCloseShares)
          const pl = side === 'Long' ? (avgExit - avgEntry) * mQ : (avgEntry - avgExit) * mQ
          trades.push({
            sym: g.sym,
            date: tripEntryDate || new Date(),
            side,
            entry: parseFloat(avgEntry.toFixed(4)),
            exit: parseFloat(avgExit.toFixed(4)),
            shares: mQ,
            pl: parseFloat(pl.toFixed(2)),
            entryTime: tripEntryTime,
            exitTime: tripExitTime,
            tradeGroupId: tripGroupId,
          })
        }
        tripSide = null
        tripShares = 0
        tripCost = 0
        tripCloseShares = 0
        tripCloseCost = 0
        tripEntryDate = undefined
        tripEntryTime = undefined
        tripExitTime = undefined
        tripGroupId = ''
      }

      sorted.forEach((ex) => {
        const delta = ex.isBuy ? ex.qty : -ex.qty
        if (pos === 0) {
          tripSide = ex.isBuy ? 'Long' : 'Short'
          tripShares = ex.qty
          tripCost = ex.price * ex.qty
          tripCloseShares = 0
          tripCloseCost = 0
          tripEntryDate = ex.date
          tripEntryTime = ex.time
          tripGroupId = newGroupId()
          pos = delta
        } else {
          const closing = (pos > 0 && !ex.isBuy) || (pos < 0 && ex.isBuy)
          if (closing) {
            tripCloseShares += ex.qty
            tripCloseCost += ex.price * ex.qty
            tripExitTime = ex.time
            pos += delta
            if (Math.abs(pos) < 0.001) {
              flushClose()
              pos = 0
            }
          } else {
            // adding to the existing position
            tripShares += ex.qty
            tripCost += ex.price * ex.qty
            pos += delta
          }
        }
      })

      // Anything left open at the end of this file → save it so a future
      // import (any day) can link its closing exit(s) back to this same trade.
      if (Math.abs(pos) > 0.001 && tripSide) {
        await replaceOpenLeg(userId, g.sym, consumedIds, {
          symbol: g.sym,
          side: tripSide,
          qty: Math.abs(pos),
          price: tripCost / tripShares,
          opened_at: (tripEntryDate || new Date()).toISOString(),
          commission: 0,
          trade_group_id: tripGroupId,
        }, 'DAS')
        carriedForward.push({ symbol: g.sym, side: tripSide, qty: Math.abs(pos) })
      } else if (consumedIds.length > 0) {
        await replaceOpenLeg(userId, g.sym, consumedIds, null, 'DAS')
      }
    }
  }

  if (!trades.length && !carriedForward.length) return { error: 'No valid trades found in this file.' }
  return { trades, carriedForward }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function DasImport({ userId, existingTrades, onImported }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [parsed, setParsed] = useState<DASParsedTrade[]>([])
  const [selected, setSelected] = useState<boolean[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [defaultRisk, setDefaultRisk] = useState('150')
  const [defaultSetup, setDefaultSetup] = useState('')
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)

  function handleFile(file: File | undefined) {
    if (!file) return
    setError('')
    setNotice('')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const res = await parseDAS(String(ev.target?.result || ''), userId)
        if (res.error) {
          setError(res.error)
          return
        }
        const trades = res.trades || []
        if (trades.length === 0) {
          const desc = (res.carriedForward || []).map((c) => `${c.qty} sh ${c.symbol} (${c.side})`).join(', ')
          setNotice(`No trades completed yet — ${desc} saved and waiting for the closing execution in a future import.`)
          return
        }
        setParsed(trades)
        setSelected(trades.map(() => true))
        setStep(2)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read the file.')
      }
    }
    reader.readAsText(file)
  }

  function toggleAll(checked: boolean) {
    setSelected(parsed.map(() => checked))
  }

  function toggleOne(i: number) {
    setSelected((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  async function doImport() {
    setImporting(true)
    const risk = parseFloat(defaultRisk) || 0
    let imp = 0
    let skipped = 0

    // Build "HH:MM:SS" from an exec time value (real DAS times are full timestamps; index fallbacks are small)
    const tod = (tv?: number): string | null => {
      if (!tv || tv < 1e9) return null
      const d = new Date(tv)
      const p = (n: number) => String(n).padStart(2, '0')
      return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    }

    for (let i = 0; i < parsed.length; i++) {
      if (!selected[i]) continue
      const t = parsed[i]
      const ds = t.date.toISOString().substring(0, 10) // YYYY-MM-DD
      const pnl = parseFloat(t.pl.toFixed(2))
      const shares = Math.round(t.shares || 0)

      // Skip if an identical trade already exists
      const isDup = existingTrades.some(
        (x) =>
          x.symbol === t.sym &&
          (x.date || '').substring(0, 10) === ds &&
          Number(x.pnl) === pnl &&
          Math.round(x.shares || 0) === shares
      )
      if (isDup) {
        skipped++
        continue
      }

      const tradeData: TradeInsert = {
        symbol: t.sym,
        type: t.side || 'Long',
        date: `${ds}T${tod(t.entryTime) || '12:00:00'}`,
        exit_date: (!t.open && tod(t.exitTime)) ? `${ds}T${tod(t.exitTime)}` : null,
        entry: parseFloat((t.entry || 0).toFixed(4)),
        exit: t.exit ? parseFloat(t.exit.toFixed(4)) : null,
        shares,
        pnl,
        risk,
        commission: 0,
        setup: defaultSetup.trim() || null,
        grade: null,
        tags: [],
        notes: null,
        screenshot_url: null,
        trade_group_id: t.tradeGroupId || null,
      }

      const inserted = await insertTrade(tradeData, userId)
      if (inserted) imp++
    }

    setImportedCount(imp)
    setSkippedCount(skipped)
    setStep(3)
    setImporting(false)
    onImported()
  }

  function reset() {
    setStep(1)
    setParsed([])
    setSelected([])
    setError('')
    setNotice('')
    setImportedCount(0)
    setSkippedCount(0)
  }

  const selectedCount = selected.filter(Boolean).length
  const wins = parsed.filter((t) => t.pl >= 0).length
  const losses = parsed.length - wins

  const card: React.CSSProperties = {
    background: 'var(--bg2)',
    border: '1px solid var(--brd)',
    borderRadius: 'var(--r2, 10px)',
    padding: '20px',
    maxWidth: '640px',
    margin: '0 auto',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--txt3)',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginBottom: '5px',
    display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg3, #1a1a1a)',
    border: '1px solid var(--brd2, #333)',
    borderRadius: 'var(--r, 7px)',
    color: 'var(--txt)',
    padding: '8px 10px',
    fontSize: '12px',
    fontFamily: 'var(--mono, monospace)',
  }
  const btnPrimary: React.CSSProperties = {
    background: 'var(--ac)',
    color: '#000',
    border: 'none',
    borderRadius: 'var(--r, 7px)',
    padding: '9px 16px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
  }
  const btnGhost: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--txt2)',
    border: '1px solid var(--brd2, #333)',
    borderRadius: 'var(--r, 7px)',
    padding: '9px 16px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={card}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>
          DAS Trader Pro — Import CSV
        </div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '18px' }}>
          Upload a CSV exported from DAS. Trades are previewed before anything is saved.
        </div>

        {/* ── STEP 1: upload ── */}
        {step === 1 && (
          <>
            <div
              onClick={() => document.getElementById('das-file-input')?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFile(e.dataTransfer.files[0])
              }}
              style={{
                border: `2px dashed ${dragOver ? 'var(--ac)' : 'var(--brd2, #333)'}`,
                borderRadius: 'var(--r2, 10px)',
                padding: '34px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '14px',
                transition: '.15s',
              }}
            >
              <div style={{ fontSize: '24px', color: 'var(--txt3)', marginBottom: '6px' }}>⇪</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Drop your DAS CSV here</div>
              <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>or click to browse</div>
              <input
                id="das-file-input"
                type="file"
                accept=".csv,.txt"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Default Risk / 1R ($)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={defaultRisk}
                  onChange={(e) => setDefaultRisk(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Default Setup (optional)</label>
                <input
                  style={{ ...inputStyle, fontFamily: 'var(--sans)' }}
                  type="text"
                  placeholder="e.g. Breakout"
                  value={defaultSetup}
                  onChange={(e) => setDefaultSetup(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--red-d, rgba(239,68,68,.12))',
                  borderRadius: 'var(--r, 7px)',
                  padding: '8px 11px',
                  fontSize: '11px',
                  color: 'var(--red, #ef4444)',
                  marginTop: '8px',
                }}
              >
                ⚠ {error}
              </div>
            )}
            {notice && (
              <div
                style={{
                  background: 'rgba(59,130,246,.1)',
                  border: '1px solid rgba(59,130,246,.2)',
                  borderRadius: 'var(--r, 7px)',
                  padding: '8px 11px',
                  fontSize: '11px',
                  color: '#3B82F6',
                  marginTop: '8px',
                }}
              >
                ℹ️ {notice}
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: preview ── */}
        {step === 2 && (
          <>
            <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '8px' }}>
              {parsed.length} trade{parsed.length === 1 ? '' : 's'} found — uncheck any you don&apos;t
              want to import.
            </div>
            <div
              style={{
                maxHeight: '320px',
                overflowY: 'auto',
                border: '1px solid var(--brd)',
                borderRadius: 'var(--r, 7px)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: 'var(--txt3)', textAlign: 'left' }}>
                    <th style={{ padding: '7px 8px' }}>
                      <input
                        type="checkbox"
                        checked={selectedCount === parsed.length && parsed.length > 0}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </th>
                    <th style={{ padding: '7px 8px' }}>Sym</th>
                    <th style={{ padding: '7px 8px' }}>Date</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right' }}>Entry</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right' }}>Exit</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((t, i) => {
                    const isW = t.pl >= 0
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--brd)' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="checkbox"
                            checked={!!selected[i]}
                            onChange={() => toggleOne(i)}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>
                          {t.sym}
                          {t.open && (
                            <span style={{ color: 'var(--txt3)', fontWeight: 400 }}> (open)</span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--txt2)' }}>
                          {t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td
                          style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontFamily: 'var(--mono, monospace)',
                          }}
                        >
                          {t.entry ? `$${t.entry.toFixed(2)}` : ''}
                        </td>
                        <td
                          style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontFamily: 'var(--mono, monospace)',
                          }}
                        >
                          {t.exit ? `$${t.exit.toFixed(2)}` : '—'}
                        </td>
                        <td
                          style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontFamily: 'var(--mono, monospace)',
                          }}
                        >
                          {t.shares || ''}
                        </td>
                        <td
                          style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontFamily: 'var(--mono, monospace)',
                            color: isW ? 'var(--ac2, #10b981)' : 'var(--red, #ef4444)',
                          }}
                        >
                          {isW ? '+' : '-'}${Math.abs(t.pl).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                margin: '8px 2px 0',
                fontSize: '10px',
              }}
            >
              <span style={{ color: 'var(--txt3)' }}>{selectedCount} selected</span>
              <span style={{ display: 'flex', gap: '10px' }}>
                <span style={{ color: 'var(--ac2, #10b981)' }}>{wins}W</span>
                <span style={{ color: 'var(--red, #ef4444)' }}>{losses}L</span>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button style={btnGhost} onClick={reset} disabled={importing}>
                Back
              </button>
              <button
                style={{ ...btnPrimary, opacity: selectedCount === 0 || importing ? 0.5 : 1 }}
                onClick={doImport}
                disabled={selectedCount === 0 || importing}
              >
                {importing ? 'Importing…' : `Import ${selectedCount} trade${selectedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: done ── */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '34px', marginBottom: '8px' }}>✓</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ac2, #10b981)' }}>
              {importedCount} trade{importedCount === 1 ? '' : 's'} imported
            </div>
            {skippedCount > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>
                {skippedCount} duplicate{skippedCount === 1 ? '' : 's'} skipped
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '18px' }}>
              <button style={btnGhost} onClick={reset}>
                Import another file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
