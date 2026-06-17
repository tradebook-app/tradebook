'use client'

import { useState, useMemo } from 'react'
import type { DayStats, TradeRow } from '@/lib/types'

type Props = { days: DayStats[]; trades: TradeRow[] }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtK(n: number): string {
  const abs = Math.abs(n)
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0)
  return `${n >= 0 ? '+' : '-'}$${s}`
}
function fmtUSD(n: number): string {
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`
}

export function MonthCalendar({ days, trades }: Props) {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [popupDate, setPopupDate] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map: Record<string, DayStats> = {}
    days.forEach(d => { map[d.date] = d })
    return map
  }, [days])

  const firstDay  = new Date(year, month, 1).getDay()
  const daysCount = new Date(year, month + 1, 0).getDate()

  function prev() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthDays = days.filter(d => d.date.startsWith(prefix))
  const monthPnl  = monthDays.reduce((s, d) => s + d.pnl, 0)

  const weeks = useMemo(() => {
    const w: Record<number, { pnl: number; days: Set<number> }> = {}
    for (let d = 1; d <= daysCount; d++) {
      const wk = Math.ceil((d + firstDay) / 7)
      if (!w[wk]) w[wk] = { pnl: 0, days: new Set() }
    }
    monthDays.forEach(ds => {
      const day = parseInt(ds.date.substring(8, 10), 10)
      const wk = Math.ceil((day + firstDay) / 7)
      if (w[wk]) { w[wk].pnl += ds.pnl; if (ds.trades > 0) w[wk].days.add(day) }
    })
    return Object.entries(w).map(([k, v]) => ({ wk: Number(k), pnl: v.pnl, days: v.days.size })).sort((a, b) => a.wk - b.wk)
  }, [monthDays, daysCount, firstDay])

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const navBtn: React.CSSProperties = {
    background: 'var(--bg4, #1a1a24)', border: '1px solid var(--brd)', color: 'var(--txt2)',
    cursor: 'pointer', fontSize: '13px', padding: '3px 9px', borderRadius: 'var(--r, 7px)',
  }

  // Day popup data
  const popupTrades = popupDate ? trades.filter(t => (t.date || '').substring(0, 10) === popupDate) : []
  const pPnl = popupTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const pWins = popupTrades.filter(t => (t.pnl || 0) > 0)
  const pWr = popupTrades.length ? (pWins.length / popupTrades.length) * 100 : 0
  const gW = pWins.reduce((s, t) => s + t.pnl, 0)
  const gL = popupTrades.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + Math.abs(t.pnl), 0)
  const pPf = gL > 0 ? gW / gL : gW > 0 ? gW : 0
  const popupTitle = popupDate
    ? new Date(`${popupDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button onClick={prev} style={navBtn}>‹</button>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>{MONTHS[month]} {year}</div>
        <button onClick={next} style={navBtn}>›</button>
        <div style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--txt3)' }}>
          Monthly: <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: monthPnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtK(monthPnl)}</span>
        </div>
      </div>

      {/* Grid + weekly sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: '10px', alignItems: 'start' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '8px', color: 'var(--txt4, #555)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const ds = `${prefix}-${String(day).padStart(2, '0')}`
              const stats = byDay[ds]
              const isToday = ds === new Date().toISOString().substring(0, 10)
              const bg = !stats ? 'var(--bg4, #16161e)'
                : stats.pnl > 0 ? 'rgba(16,185,129,.15)'
                : stats.pnl < 0 ? 'rgba(239,68,68,.12)'
                : 'rgba(255,255,255,.04)'
              const pnlColor = !stats ? 'var(--txt4)'
                : stats.pnl > 0 ? 'var(--ac)'
                : stats.pnl < 0 ? 'var(--red)' : 'var(--txt3)'
              const wr = stats && stats.trades ? Math.round((stats.wins / stats.trades) * 100) : 0
              return (
                <div
                  key={i}
                  onClick={() => { if (stats && stats.trades > 0) setPopupDate(ds) }}
                  style={{
                    background: bg, borderRadius: '6px', padding: '5px 4px', minHeight: '52px',
                    border: isToday ? '1px solid var(--ac)' : '1px solid transparent',
                    cursor: stats && stats.trades > 0 ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ fontSize: '9px', color: isToday ? 'var(--ac2)' : 'var(--txt3)' }}>{day}</div>
                  {stats && (
                    <>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: pnlColor, fontWeight: 700, marginTop: '2px' }}>
                        {fmtK(stats.pnl)}
                      </div>
                      <div style={{ fontSize: '7px', color: 'var(--txt4, #666)' }}>{stats.trades}t · {wr}%</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Weekly sidebar */}
        <div>
          {weeks.map(w => {
            const has = w.days > 0
            return (
              <div key={w.wk} style={{
                background: 'var(--bg4, #16161e)',
                border: `1px solid ${has ? (w.pnl >= 0 ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.2)') : 'var(--brd)'}`,
                borderRadius: 'var(--r, 7px)', padding: '8px 10px', marginBottom: '5px',
              }}>
                <div style={{ fontSize: '9px', color: 'var(--txt3)', fontWeight: 600 }}>Week {w.wk}</div>
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

      {/* Day detail popup */}
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

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '14px 18px' }}>
              {[
                { l: 'Net P&L', v: fmtUSD(pPnl), c: pPnl >= 0 ? 'var(--ac)' : 'var(--red)' },
                { l: 'Win Rate', v: `${pWr.toFixed(0)}%`, c: 'var(--txt)' },
                { l: 'Trades', v: String(popupTrades.length), c: 'var(--txt)' },
                { l: 'Profit Factor', v: pPf.toFixed(2), c: pPf >= 1.5 ? 'var(--ac)' : 'var(--red)' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>{s.l}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Trades table */}
            <div style={{ padding: '0 18px 18px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ color: 'var(--txt3)', textAlign: 'left' }}>
                    {['Symbol','Side','Setup','Entry','Exit','Shares','P&L','Grade'].map(h => (
                      <th key={h} style={{ padding: '7px 8px', fontSize: '9px', textTransform: 'uppercase', borderBottom: '1px solid var(--brd)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {popupTrades.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--brd)' }}>
                      <td style={{ padding: '7px 8px', fontWeight: 700, fontFamily: 'var(--mono)' }}>{t.symbol}</td>
                      <td style={{ padding: '7px 8px', color: (t.type || 'Long') === 'Short' ? 'var(--red)' : 'var(--ac)' }}>{(t.type || 'Long')}</td>
                      <td style={{ padding: '7px 8px', color: 'var(--txt3)' }}>{t.setup || '—'}</td>
                      <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)' }}>{t.entry ? `$${t.entry}` : '—'}</td>
                      <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)' }}>{t.exit ? `$${t.exit}` : '—'}</td>
                      <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)' }}>{t.shares || '—'}</td>
                      <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)', fontWeight: 700, color: (t.pnl || 0) >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtUSD(t.pnl || 0)}</td>
                      <td style={{ padding: '7px 8px', color: 'var(--txt3)' }}>{t.grade || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
