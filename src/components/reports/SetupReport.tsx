'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades, fmtPnl } from '@/lib/analytics'
import { VerticalBars } from './VerticalBars'

type Props = { trades: TradeRow[] }

export function SetupReport({ trades }: Props) {
  const closed = closedTrades(trades)

  // Group by setup
  const bySetup: Record<string, { pnl: number; trades: number; wins: number; losses: number; grossWin: number; grossLoss: number }> = {}
  closed.forEach(t => {
    const key = t.setup || 'No Setup'
    if (!bySetup[key]) bySetup[key] = { pnl: 0, trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0 }
    bySetup[key].pnl    += t.pnl
    bySetup[key].trades += 1
    if (t.pnl > 0) { bySetup[key].wins++; bySetup[key].grossWin  += t.pnl }
    else            { bySetup[key].losses++;bySetup[key].grossLoss += t.pnl }
  })

  const rows = Object.entries(bySetup)
    .map(([setup, s]) => ({ setup, ...s, wr: s.trades ? (s.wins / s.trades) * 100 : 0, pf: s.grossLoss < 0 ? s.grossWin / Math.abs(s.grossLoss) : s.grossWin }))
    .sort((a, b) => b.pnl - a.pnl)

  if (!rows.length) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>
        No closed trades yet. Add setups when logging trades to see strategy analysis.
      </div>
    )
  }

  const maxPnl = Math.max(...rows.map(r => Math.abs(r.pnl)), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Bar chart */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>P&L by Setup</div>
        <div style={{ padding: '16px 18px' }}>
          <VerticalBars items={rows.map(r => ({
            label: r.setup,
            value: r.pnl,
            sub: `${r.trades} trades · ${r.wr.toFixed(0)}% WR · ${r.pf.toFixed(2)} PF`,
          }))} />
        </div>
        <div style={{ fontSize: '9px', color: 'var(--txt3)', padding: '0 18px 14px' }}>
          WR = win rate · PF = profit factor (gross win / gross loss)
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>Setup Breakdown</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Setup','Trades','W','L','Win Rate','Profit Factor','Gross Win','Gross Loss','Net P&L'].map(h => (
                <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, borderBottom: '1px solid var(--brd)' }}>{r.setup}</td>
                <td style={{ padding: '8px 12px', fontSize: '11px', borderBottom: '1px solid var(--brd)' }}>{r.trades}</td>
                <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--ac)', borderBottom: '1px solid var(--brd)' }}>{r.wins}</td>
                <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{r.losses}</td>
                <td style={{ padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--mono)', color: r.wr >= 50 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{r.wr.toFixed(1)}%</td>
                <td style={{ padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--mono)', color: r.pf >= 1.5 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{r.pf.toFixed(2)}</td>
                <td style={{ padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--ac)', borderBottom: '1px solid var(--brd)' }}>+${r.grossWin.toFixed(0)}</td>
                <td style={{ padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--red)', borderBottom: '1px solid var(--brd)' }}>${Math.abs(r.grossLoss).toFixed(0)}</td>
                <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: r.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{fmtPnl(r.pnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
