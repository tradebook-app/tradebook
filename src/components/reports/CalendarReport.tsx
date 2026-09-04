'use client'

import { useMemo, useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { calcDailyPnl } from '@/lib/analytics'

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

export function CalendarReport({ trades }: Props) {
  const today = new Date()
  const [view,  setView]  = useState<View>('month')
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Daily P&L (reuse the existing helper — no new P&L math here).
  const byDay = useMemo(() => {
    const map: Record<string, number> = {}
    calcDailyPnl(trades).forEach(d => { map[d.date] = d.pnl })
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
    return Object.entries(byDay).reduce((s, [d, p]) => d.startsWith(prefix) ? s + p : s, 0)
  }, [byDay, year, month])

  const weeks = useMemo(() => {
    const out: { label: string; pnl: number; days: number }[] = []
    for (let w = 0; w * 7 < cells.length; w++) {
      const weekCells = cells.slice(w * 7, w * 7 + 7)
      let pnl = 0, days = 0
      weekCells.forEach(d => {
        if (d == null) return
        const p = byDay[key(year, month, d)]
        if (p !== undefined) { pnl += p; days += 1 }
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const ds = key(year, month, day)
              const pnl = byDay[ds]
              const c = dayColors(pnl)
              const isToday = ds === todayStr
              return (
                <div key={i} style={{
                  background: c.bg, borderRadius: '6px', padding: '5px 4px', minHeight: '52px',
                  border: isToday ? '1px solid var(--ac)' : '1px solid transparent',
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: isToday ? 'var(--ac2)' : 'var(--txt2)' }}>{day}</div>
                  {pnl !== undefined && (
                    <div style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: c.fg, fontWeight: 700, marginTop: '2px' }}>
                      {fmtK(pnl)}
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
                    textAlign: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--txt2)', letterSpacing: '.01em',
                    background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '3px 0',
                  }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {matrix.map((cell, i) => {
                  const ds = dstr(cell.date)
                  const pnl = cell.inMonth ? byDay[ds] : undefined
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
    </div>
  )
}
