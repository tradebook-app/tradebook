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

  // Calculate R-multiples
  const rMultiples = closed.map(t => parseFloat((t.pnl / t.risk).toFixed(2)))
  const avgR  = rMultiples.reduce((s, r) => s + r, 0) / rMultiples.length
  const maxR  = Math.max(...rMultiples)
  const minR  = Math.min(...rMultiples)
  const posR  = rMultiples.filter(r => r > 0)
  const negR  = rMultiples.filter(r => r < 0)
  const avgWinR  = posR.length ? posR.reduce((s, r) => s + r, 0) / posR.length : 0
  const avgLossR = negR.length ? Math.abs(negR.reduce((s, r) => s + r, 0) / negR.length) : 0
  const expectancy = avgR

  // Bucket into ranges: <-3, -3 to -2, -2 to -1, -1 to 0, 0 to 1, 1 to 2, 2 to 3, >3
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        {[
          { label: 'Expectancy', val: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`, color: avgR >= 0 ? 'var(--ac)' : 'var(--red)' },
          { label: 'Avg Win R',  val: `+${avgWinR.toFixed(2)}R`,  color: 'var(--ac)' },
          { label: 'Avg Loss R', val: `-${avgLossR.toFixed(2)}R`, color: 'var(--red)' },
          { label: 'Best Trade', val: `+${maxR.toFixed(2)}R`,     color: 'var(--ac)' },
          { label: 'Worst Trade',val: `${minR.toFixed(2)}R`,      color: 'var(--red)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
            <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: s.color }}>{s.val}</div>
          </div>
        ))}
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
                <div style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: isPos ? 'var(--ac)' : 'var(--red)', marginBottom: '4px', fontWeight: b.count > 0 ? 700 : 400 }}>
                  {b.count > 0 ? b.count : ''}
                </div>
                <div style={{
                  width: '100%', height: `${barH}px`,
                  background: isPos ? 'rgba(16,185,129,.5)' : 'rgba(239,68,68,.5)',
                  borderRadius: '3px 3px 0 0', minHeight: b.count ? '4px' : '0',
                  border: isPos ? '1px solid rgba(16,185,129,.6)' : '1px solid rgba(239,68,68,.6)',
                }} />
                <div style={{ fontSize: '8px', color: 'var(--txt3)', marginTop: '4px', textAlign: 'center' }}>{b.label}</div>
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Symbol','P&L','Risk (1R)','R-Multiple'].map(h => (
                <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {closed.sort((a, b) => (b.pnl / b.risk) - (a.pnl / a.risk)).map((t, i) => {
              const rm = t.pnl / t.risk
              return (
                <tr key={i}>
                  <td style={{ padding: '8px 14px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.symbol}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', color: t.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)' }}>${t.risk.toFixed(2)}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontWeight: 700, color: rm >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{rm >= 0 ? '+' : ''}{rm.toFixed(2)}R</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
