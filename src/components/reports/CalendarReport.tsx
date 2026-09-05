'use client'

import { useMemo, useState } from 'react'
import type { TradeRow, DayStats } from '@/lib/types'
import { calcDailyPnl, fmtProfitFactor } from '@/lib/analytics'

type Props = { trades: TradeRow[] }
type View = 'month' | 'year'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
// Week starts on Monday.
const DOW    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// 0=Sun..6=Sat  ->  0=Mon..6=Sun (column index for a Monday-first grid)
const mondayIndex = (jsDay: number) => (jsDay + 6) % 7

function fmtK(n: number): string {
  const abs = Math.abs(n)
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0)
  return `${n >= 0 ? '+' : '-'}$${s}`
}

// Same day-cell colour convention as the Dashboard month calendar.
function dayColors(pnl: number | undefined) {
  if (pnl === undefined) return { bg: 'var(--bg4, #16161e)', fg: 'var(--txt4)' }
  if (pnl > 0) return { bg: 'rgba(16,185,129,.15)', fg: 'var(--ac)' }
  if (pnl < 0) return { bg: 'rgba(239,68,68,.12)', fg: 'var(--red)' }
  return { bg: 'rgba(255,255,255,.04)', fg: 'var(--txt3)' }
}

const navBtn: React.CSSProperties = {
  background: 'var(--bg4, #1a1a24)', border: '1px solid var(--brd)', color: 'var(--txt2)',
  cursor: 'pointer', fontSize: '13px', padding: '3px 9px', borderRadius: 'var(--r, 7px)',
}

// cells for a month grid: leading blanks + day numbers, padded to whole weeks
function monthCells(year: number, month: number): (number | null)[] {
  const firstDay  = mondayIndex(new Date(year, month, 1).getDay())
  const daysCount = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// A full 6-row (42-cell) grid, including the leading/trailing days that
// belong to the adjacent months — used by the Year view mini-calendars.
function monthMatrix(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const startDow  = mondayIndex(new Date(year, month, 1).getDay())
  const daysCount = new Date(year, month + 1, 0).getDate()
  const out: { date: Date; inMonth: boolean }[] = []
  for (let i = startDow; i > 0; i--) out.push({ date: new Date(year, month, 1 - i), inMonth: false })
  for (let d = 1; d <= daysCount; d++) out.push({ date: new Date(year, month, d), inMonth: true })
  while (out.length < 42) {
    const last = out[out.length - 1].date
    out.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
  }
  return out
}

const dstr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function fmtUSD(n: number): string {
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`
}

// Multi-exit trades collapsed into one row — same pattern as the Dashboard
// calendar's day popup (src/components/dashboard/MonthCalendar.tsx).
type GroupedRow = {
  key: string
  legs: TradeRow[]
  isGroup: boolean
  symbol: string
  type: 'Long' | 'Short'
  avgEntry: number
  lastExit: number | null
  totalShares: number
  totalPnl: number
  grade: string | null
  setup: string | null
}

function buildGroupedRows(rows: TradeRow[]): GroupedRow[] {
  const groups: Record<string, TradeRow[]> = {}
  const singles: TradeRow[] = []
  for (const t of rows) {
    if (t.trade_group_id) {
      if (!groups[t.trade_group_id]) groups[t.trade_group_id] = []
      groups[t.trade_group_id].push(t)
    } else {
      singles.push(t)
    }
  }
  const out: GroupedRow[] = []
  for (const legs of Object.values(groups)) {
    const sortedByExit = [...legs].sort((a, b) => (a.exit_date || a.date).localeCompare(b.exit_date || b.date))
    const totalShares = legs.reduce((s, l) => s + l.shares, 0)
    const totalCost = legs.reduce((s, l) => s + l.entry * l.shares, 0)
    const lastLeg = sortedByExit[sortedByExit.length - 1]
    out.push({
      key: legs[0].trade_group_id as string,
      legs: sortedByExit,
      isGroup: legs.length > 1,
      symbol: legs[0].symbol,
      type: legs[0].type,
      avgEntry: totalShares > 0 ? totalCost / totalShares : 0,
      lastExit: lastLeg?.exit ?? null,
      totalShares,
      totalPnl: legs.reduce((s, l) => s + l.pnl, 0),
      grade: lastLeg?.grade ?? null,
      setup: lastLeg?.setup ?? null,
    })
  }
  for (const t of singles) {
    out.push({
      key: t.id, legs: [t], isGroup: false, symbol: t.symbol, type: t.type,
      avgEntry: t.entry, lastExit: t.exit, totalShares: t.shares, totalPnl: t.pnl,
      grade: t.grade, setup: t.setup,
    })
  }
  return out
}

export function CalendarReport({ trades }: Props) {
  const today = new Date()
  const [view,  setView]  = useState<View>('month')
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [popupDate, setPopupDate] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(k: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  // Daily stats (reuse the existing helper — no new P&L math here).
  const byDay = useMemo(() => {
    const map: Record<string, DayStats> = {}
    calcDailyPnl(trades).forEach(d => { map[d.date] = d })
    return map
  }, [trades])

  const todayStr = today.toISOString().substring(0, 10)
  const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }
  function goThisMonth() { setYear(today.getFullYear()); setMonth(today.getMonth()) }
  function openMonth(m: number) { setMonth(m); setView('month') }

  // ─── Month view ──────────────────────────────────────────────────────────
  const cells = useMemo(() => monthCells(year, month), [year, month])
  const monthPnl = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return Object.entries(byDay).reduce((s, [d, st]) => d.startsWith(prefix) ? s + st.pnl : s, 0)
  }, [byDay, year, month])

  const weeks = useMemo(() => {
    const out: { label: string; pnl: number; days: number }[] = []
    for (let w = 0; w * 7 < cells.length; w++) {
      const weekCells = cells.slice(w * 7, w * 7 + 7)
      let pnl = 0, days = 0
      weekCells.forEach(d => {
        if (d == null) return
        const st = byDay[key(year, month, d)]
        if (st !== undefined) { pnl += st.pnl; days += 1 }
      })
      out.push({ label: `Week ${w + 1}`, pnl, days })
    }
    return out
  }, [cells, byDay, year, month])

  const monthView = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button onClick={prevMonth} style={navBtn}>‹</button>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} style={navBtn}>›</button>
        <button onClick={goThisMonth} style={{ ...navBtn, fontSize: '11px', fontWeight: 600 }}>This month</button>
        <div style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--txt3)' }}>
          Monthly: <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: monthPnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtK(monthPnl)}</span>
        </div>
      </div>

      <div className="calr-grid">
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '6px' }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 500, color: 'var(--txt)', padding: '0 0 4px', borderBottom: '2px solid var(--ac)' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const ds = key(year, month, day)
              const st = byDay[ds]
              const c = dayColors(st?.pnl)
              const isToday = ds === todayStr
              const clickable = !!st && st.trades > 0
              return (
                <div key={i}
                  onClick={() => { if (clickable) setPopupDate(ds) }}
                  style={{
                    background: c.bg, borderRadius: '6px', padding: '5px 4px', minHeight: '52px',
                    border: isToday ? '1px solid var(--ac)' : '1px solid transparent',
                    cursor: clickable ? 'pointer' : 'default',
                  }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: isToday ? 'var(--ac2)' : 'var(--txt2)' }}>{day}</div>
                  {st !== undefined && (
                    <div style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: c.fg, fontWeight: 700, marginTop: '2px' }}>
                      {fmtK(st.pnl)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* P&L per week sidebar */}
        <div className="calr-weeks">
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>P&L per week</div>
          {weeks.map(w => {
            const has = w.days > 0
            return (
              <div key={w.label} className="calr-week-item" style={{
                background: 'var(--bg4, #16161e)',
                border: `1px solid ${has ? (w.pnl >= 0 ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.2)') : 'var(--brd)'}`,
                borderRadius: 'var(--r, 7px)', padding: '8px 10px',
              }}>
                <div style={{ fontSize: '9px', color: 'var(--txt3)', fontWeight: 600 }}>{w.label}</div>
                <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--mono)', color: has ? (w.pnl >= 0 ? 'var(--ac)' : 'var(--red)') : 'var(--txt3)' }}>
                  {has ? fmtK(w.pnl) : '$0'}
                </div>
                <div style={{ fontSize: '8px', marginTop: '2px' }}>
                  <span style={{ background: has ? 'var(--ac-d, rgba(16,185,129,.12))' : 'rgba(255,255,255,.05)', color: has ? 'var(--ac)' : 'var(--txt3)', padding: '1px 5px', borderRadius: '3px' }}>
                    {w.days} day{w.days !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )

  // ─── Year view ───────────────────────────────────────────────────────────
  const isCurrentYear = year === today.getFullYear()

  const yearView = (
    <>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: '8px' }}>Year</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <button onClick={() => setYear(y => y - 1)} style={navBtn}>‹</button>
          <div style={{ fontSize: '17px', fontWeight: 800, minWidth: '58px', textAlign: 'center' }}>{year}</div>
          <button onClick={() => setYear(y => y + 1)} style={navBtn}>›</button>
        </div>
      </div>

      <div className="calr-year">
        {MONTHS.map((mLabel, m) => {
          const matrix = monthMatrix(year, m)
          return (
            <div key={m} style={{ background: 'var(--bg4, #16161e)', border: '1px solid var(--brd)', borderRadius: 'var(--r2, 10px)', padding: '12px' }}>
              <button
                onClick={() => openMonth(m)}
                style={{ background: 'none', border: 'none', color: isCurrentYear && m === today.getMonth() ? 'var(--ac2)' : 'var(--txt)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '8px', display: 'block' }}
              >{mLabel}</button>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
                {DOW.map((d, di) => (
                  <div key={di} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    aspectRatio: '2 / 1', lineHeight: 1,
                    fontSize: '9px', fontWeight: 700, color: 'var(--txt2)', letterSpacing: '.01em',
                    background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px',
                  }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {matrix.map((cell, i) => {
                  const ds = dstr(cell.date)
                  const pnl = cell.inMonth ? byDay[ds]?.pnl : undefined
                  const isToday = cell.inMonth && ds === todayStr
                  let bg = 'var(--bg3)', fg = 'var(--txt2)'
                  if (!cell.inMonth) { fg = 'var(--txt3)' }
                  else if (isToday) { bg = 'var(--ac)'; fg = '#000' }
                  else if (pnl !== undefined) {
                    bg = pnl > 0 ? 'rgba(16,185,129,.18)' : pnl < 0 ? 'rgba(239,68,68,.16)' : 'rgba(255,255,255,.05)'
                    fg = pnl > 0 ? 'var(--ac)' : pnl < 0 ? 'var(--red)' : 'var(--txt2)'
                  }
                  return (
                    <button
                      key={i}
                      className="calr-mini-cell"
                      onClick={() => openMonth(m)}
                      title={pnl !== undefined ? fmtK(pnl) : undefined}
                      style={{
                        background: bg, color: fg,
                        fontWeight: isToday || pnl !== undefined ? 700 : 500,
                        border: `1px solid ${isToday ? 'var(--ac)' : 'var(--brd)'}`,
                      }}
                    >{cell.date.getDate()}</button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )

  // ─── Day popup (same modal as the Dashboard calendar) ────────────────────
  // Closed trades only — an open position opened this day isn't a win, loss,
  // or breakeven yet, and used to still count toward Trades/Win Rate/Profit
  // Factor here even though the calendar cells' own per-day stats
  // (calcDailyPnl, above) already exclude it.
  const popupTrades = popupDate ? trades.filter(t => (t.date || '').substring(0, 10) === popupDate && t.exit && t.exit > 0) : []
  const pPnl = popupTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const pWins = popupTrades.filter(t => (t.pnl || 0) > 0)
  const pWr = popupTrades.length ? (pWins.length / popupTrades.length) * 100 : 0
  const gW = pWins.reduce((s, t) => s + t.pnl, 0)
  const gL = popupTrades.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + Math.abs(t.pnl), 0)
  // A ratio (gross win ÷ gross loss); with wins and no losses that's
  // mathematically infinite, not the raw dollar amount of the wins.
  const pPf = gL > 0 ? gW / gL : gW > 0 ? Infinity : 0
  const popupTitle = popupDate
    ? new Date(`${popupDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px 18px' }}>
      <style>{`
        .calr-grid { display: grid; grid-template-columns: minmax(0, 1fr) 130px; gap: 12px; align-items: start; }
        .calr-weeks { display: flex; flex-direction: column; gap: 5px; }
        .calr-year { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .calr-mini-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 9px; line-height: 1; border-radius: 5px; cursor: pointer; padding: 0; }
        @media (max-width: 1000px) { .calr-year { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 760px)  { .calr-year { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 768px) {
          .calr-grid { grid-template-columns: 1fr; }
          .calr-weeks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
        }
        @media (max-width: 460px) { .calr-year { grid-template-columns: 1fr; } }
      `}</style>

      {/* View toggle */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', background: 'var(--bg4)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '3px', gap: '2px' }}>
          {(['month', 'year'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--sans)', transition: '.15s',
              background: view === v ? 'var(--ac)' : 'transparent',
              color: view === v ? '#000' : 'var(--txt2)',
            }}>{v === 'month' ? 'Month' : 'Year'}</button>
          ))}
        </div>
      </div>

      {view === 'year' && (
        <div style={{ marginBottom: '24px', paddingBottom: '22px', borderBottom: '1px solid var(--brd)' }}>
          {yearView}
        </div>
      )}
      {monthView}

      {/* Day detail popup — mirrors src/components/dashboard/MonthCalendar.tsx */}
      {popupDate && (
        <div
          onClick={() => setPopupDate(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', width: '100%', maxWidth: '720px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--brd)' }}>
              <span style={{ fontSize: '14px', fontWeight: 800 }}>{popupTitle}</span>
              <button onClick={() => setPopupDate(null)} style={{ background: 'none', border: 'none', color: 'var(--txt3)', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '14px 18px' }}>
              {[
                { l: 'Net P&L', v: fmtUSD(pPnl), c: pPnl >= 0 ? 'var(--ac)' : 'var(--red)' },
                { l: 'Win Rate', v: `${pWr.toFixed(0)}%`, c: 'var(--txt)' },
                { l: 'Trades', v: String(popupTrades.length), c: 'var(--txt)' },
                { l: 'Profit Factor', v: fmtProfitFactor(pPf), c: pPf >= 1.5 ? 'var(--ac)' : 'var(--red)' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>{s.l}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '0 18px 18px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ color: 'var(--txt3)', textAlign: 'left' }}>
                    {['Symbol','Side','Setup','Entry','Exit','Size','P&L','Grade'].map(h => (
                      <th key={h} style={{ padding: '7px 8px', fontSize: '9px', textTransform: 'uppercase', borderBottom: '1px solid var(--brd)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildGroupedRows(popupTrades).map(row => {
                    const isExpanded = expandedGroups.has(row.key)
                    const mainRow = (
                      <tr
                        key={row.key}
                        onClick={() => row.isGroup && toggleGroup(row.key)}
                        style={{ borderBottom: '1px solid var(--brd)', cursor: row.isGroup ? 'pointer' : 'default' }}
                      >
                        <td style={{ padding: '7px 8px', fontWeight: 700, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {row.isGroup && (
                            <span style={{ fontSize: '9px', color: 'var(--txt3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '.1s', display: 'inline-block' }}>▶</span>
                          )}
                          {row.symbol}
                          {row.isGroup && (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '1px 6px' }}>
                              {row.legs.length} exits
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '7px 8px', color: row.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>{row.type}</td>
                        <td style={{ padding: '7px 8px', color: 'var(--txt3)' }}>{row.setup || '—'}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)' }}>{row.avgEntry ? `$${row.avgEntry.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)' }}>{row.lastExit ? `$${row.lastExit.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)' }}>{row.totalShares || '—'}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)', fontWeight: 700, color: row.totalPnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtUSD(row.totalPnl)}</td>
                        <td style={{ padding: '7px 8px', color: 'var(--txt3)' }}>{row.grade || '—'}</td>
                      </tr>
                    )

                    if (!row.isGroup || !isExpanded) return mainRow

                    const legRows = row.legs.map((t, i) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--brd)', background: 'var(--bg3)' }}>
                        <td style={{ padding: '6px 8px', fontSize: '10px', color: 'var(--txt3)', paddingLeft: '22px' }}>exit {i + 1}</td>
                        <td />
                        <td />
                        <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt3)' }}>${t.entry.toFixed(2)}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: '10px' }}>{t.exit ? `$${t.exit.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: '10px' }}>{t.shares}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 700, color: (t.pnl || 0) >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtUSD(t.pnl || 0)}</td>
                        <td />
                      </tr>
                    ))

                    return [mainRow, ...legRows]
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
