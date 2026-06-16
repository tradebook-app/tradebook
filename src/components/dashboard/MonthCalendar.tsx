'use client'

import { useState, useMemo } from 'react'
import type { DayStats } from '@/lib/types'

type Props = { days: DayStats[] }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export function MonthCalendar({ days }: Props) {
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  // Build lookup: date string → stats
  const byDay = useMemo(() => {
    const map: Record<string, DayStats> = {}
    days.forEach(d => { map[d.date] = d })
    return map
  }, [days])

  // Calendar grid
  const firstDay  = new Date(year, month, 1).getDay()
  const daysCount = new Date(year, month + 1, 0).getDate()

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Month totals
  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    const relevant = days.filter(d => d.date.startsWith(prefix))
    return {
      pnl:    relevant.reduce((s, d) => s + d.pnl, 0),
      trades: relevant.reduce((s, d) => s + d.trades, 0),
      wins:   relevant.filter(d => d.pnl > 0).length,
      days:   relevant.length,
    }
  }, [days, year, month])

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ]

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button
          onClick={prev}
          style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
        >‹</button>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>
          {MONTHS[month]} {year}
        </div>
        <button
          onClick={next}
          style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
        >›</button>
      </div>

      {/* Month summary */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap',
      }}>
        {[
          { label: 'P&L', val: `${monthStats.pnl >= 0 ? '+' : ''}$${monthStats.pnl.toFixed(0)}`, color: monthStats.pnl >= 0 ? 'var(--ac)' : 'var(--red)' },
          { label: 'Days', val: String(monthStats.days), color: 'var(--txt2)' },
          { label: 'Trades', val: String(monthStats.trades), color: 'var(--txt2)' },
          { label: 'Green Days', val: String(monthStats.wins), color: 'var(--ac)' },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, background: 'var(--bg4)', borderRadius: 'var(--r)',
            padding: '6px 8px', textAlign: 'center', minWidth: '60px',
          }}>
            <div style={{ fontSize: '8px', color: 'var(--txt3)', marginBottom: '2px' }}>{s.label}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* DOW headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '8px', color: 'var(--txt4)', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />

          const ds    = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const stats = byDay[ds]
          const isToday = ds === new Date().toISOString().substring(0, 10)

          const bg    = !stats ? 'var(--bg4)'
            : stats.pnl > 0 ? 'rgba(16,185,129,.15)'
            : stats.pnl < 0 ? 'rgba(239,68,68,.12)'
            : 'rgba(255,255,255,.04)'

          const pnlColor = !stats ? 'var(--txt4)'
            : stats.pnl > 0 ? 'var(--ac)'
            : stats.pnl < 0 ? 'var(--red)'
            : 'var(--txt3)'

          return (
            <div
              key={i}
              title={stats ? `${ds}: ${stats.pnl >= 0 ? '+' : ''}$${stats.pnl.toFixed(2)} · ${stats.trades} trade${stats.trades !== 1 ? 's' : ''}` : ds}
              style={{
                background: bg,
                borderRadius: '5px',
                padding: '4px 3px',
                textAlign: 'center',
                border: isToday ? '1px solid var(--ac)' : '1px solid transparent',
                cursor: stats ? 'pointer' : 'default',
                transition: '.1s',
              }}
            >
              <div style={{ fontSize: '8px', color: isToday ? 'var(--ac2)' : 'var(--txt3)', marginBottom: '1px' }}>{day}</div>
              {stats && (
                <>
                  <div style={{ fontSize: '8px', fontFamily: 'var(--mono)', color: pnlColor, fontWeight: 700 }}>
                    {stats.pnl >= 0 ? '+' : ''}${Math.abs(stats.pnl) >= 1000 ? `${(stats.pnl / 1000).toFixed(1)}k` : stats.pnl.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '7px', color: 'var(--txt4)' }}>{stats.trades}t</div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
