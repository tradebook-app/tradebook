'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades } from '@/lib/analytics'

type Props = { trades: TradeRow[] }

export function RiskReport({ trades }: Props) {
  const closed = closedTrades(trades).filter(t => t.risk > 0)

  if (!closed.length) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>
        No trades with risk (1R) defined yet. Add risk when logging trades to see R-multiple analysis.
      </div>
    )
  }

  const rMultiples = closed.map(t => parseFloat((t.pnl / t.risk).toFixed(2)))
  const avgR  = rMultiples.reduce((s, r) => s + r, 0) / rMultiples.length
  const maxR  = Math.max(...rMultiples)
  const minR  = Math.min(...rMultiples)
  const posR  = rMultiples.filter(r => r > 0)
  const negR  = rMultiples.filter(r => r < 0)
  const avgWinR  = posR.length ? posR.reduce((s, r) => s + r, 0) / posR.length : 0
  const avgLossR = negR.length ? Math.abs(negR.reduce((s, r) => s + r, 0) / negR.length) : 0

  const BUCKETS = [
    { label: '< -3R',   min: -Infinity, max: -3 },
    { label: '-3R',     min: -3,        max: -2 },
    { label: '-2R',     min: -2,        max: -1 },
    { label: '-1R',     min: -1,        max: 0  },
    { label: '0 to 1R', min: 0,         max: 1  },
    { label: '1 to 2R', min: 1,         max: 2  },
    { label: '2 to 3R', min: 2,         max: 3  },
    { label: '> 3R',    min: 3,         max: Infinity },
  ]

  const bucketed = BUCKETS.map(b => ({
    ...b,
    count: rMultiples.filter(r => r >= b.min && r < b.max).length,
  }))

  const maxCount = Math.max(...bucketed.map(b => b.count), 1)

  const now = new Date()
  const weekStart = (() => {
    const d = new Date(now); const dow = d.getDay()
    d.setDate(d.getDate() + ((dow === 0 ? -6 : 1) - dow)); d.setHours(0, 0, 0, 0); return d
  })()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart  = new Date(now.getFullYear(), 0, 1)
  const sumRSince = (start: Date) =>
    closed.reduce((s, t) => (new Date(t.date) >= start ? s + t.pnl / t.risk : s), 0)
  const rWeek  = sumRSince(weekStart)
  const rMonth = sumRSince(monthStart)
  const rYear  = sumRSince(yearStart)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Summary cards — scrollable on mobile */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: '10px', minWidth: '500px' }}>
          {[
            { label: 'Expectancy', val: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`, color: avgR >= 0 ? 'var(--ac)' : 'var(--red)' },
            { label: 'Avg Win R',  val: `+${avgWinR.toFixed(2)}R`,  color: 'var(--ac)' },
            { label: 'Avg Loss R', val: `-${avgLossR.toFixed(2)}R`, color: 'var(--red)' },
            { label: 'Best Trade', val: `+${maxR.toFixed(2)}R`,     color: 'var(--ac)' },
            { label: 'Worst Trade',val: `${minR.toFixed(2)}R`,      color: 'var(--red)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{s.label}</div>
              <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* R-Multiple Performance by period */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          R-Multiple Performance
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(130px, 1fr))', gap: '12px', minWidth: '420px' }}>
            {([
              ['This Week',  rWeek],
              ['This Month', rMonth],
              ['This Year',  rYear],
            ] as [string, number][]).map(([label, val]) => (
              <div key={label} style={{ background: 'var(--bg4, #16161e)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
                <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--mono)', color: val >= 0 ? 'var(--ac)' : 'var(--red)' }}>
                  {val >= 0 ? '+' : ''}{val.toFixed(2)}R
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution chart */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          R-Multiple Distribution
        </div>
        <div style={{ padding: '20px 18px' }}>
          {bucketed.map((b, i) => {
            const barH  = b.count ? (b.count / maxCount) * 120 : 0
            const isPos = b.min >= 0
            return (
              <div key={i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', width: `${100 / bucketed.length}%`, padding: '0 3px', verticalAlign: 'bottom' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: isPos ? 'var(--ac)' : 'var(--red)', marginBottom: '4px', fontWeight: 800 }}>
                  {b.count > 0 ? b.count : ''}
                </div>
                <div style={{
                  width: '100%', height: `${barH}px`,
                  background: isPos ? 'var(--bar-green-1)' : 'var(--bar-red-1)',
                  borderRadius: '3px 3px 0 0', minHeight: b.count ? '4px' : '0',
                  border: isPos ? '1px solid var(--ac)' : '1px solid var(--red)',
                }} />
                <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt2, #b8b8c4)', marginTop: '6px', textAlign: 'center' }}>{b.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* R-Multiple table */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          Individual Trade R-Multiples
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '320px' }}>
            <thead>
              <tr>
                {['Symbol','P&L','Risk (1R)','R-Multiple'].map(h => (
                  <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {closed.sort((a, b) => (b.pnl / b.risk) - (a.pnl / a.risk)).map((t, i) => {
                const rm = t.pnl / t.risk
                return (
                  <tr key={i}>
                    <td style={{ padding: '8px 14px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.symbol}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', color: t.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>${t.risk.toFixed(2)}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontWeight: 700, color: rm >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{rm >= 0 ? '+' : ''}{rm.toFixed(2)}R</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
