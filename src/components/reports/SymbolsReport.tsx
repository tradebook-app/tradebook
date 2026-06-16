'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades, calcSymbolStats, fmtPnl } from '@/lib/analytics'

type Props = { trades: TradeRow[] }

export function SymbolsReport({ trades }: Props) {
  const stats = calcSymbolStats(closedTrades(trades))
  const maxPnl = Math.max(...stats.map(s => Math.abs(s.pnl)), 1)

  if (!stats.length) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>
        No closed trades yet
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Top symbols bar chart */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          P&L by Symbol
        </div>
        <div style={{ padding: '16px 18px' }}>
          {stats.slice(0, 15).map((s, i) => {
            const barW = (Math.abs(s.pnl) / maxPnl) * 100
            const wr   = (s.wins / s.trades) * 100
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '55px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--txt)', flexShrink: 0 }}>{s.symbol}</div>
                <div style={{ flex: 1, height: '24px', background: 'var(--bg4)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${barW}%`, height: '100%',
                    background: s.pnl >= 0 ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)',
                    borderRadius: '4px',
                  }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: '8px', gap: '8px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', fontWeight: 700, color: s.pnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>
                      {fmtPnl(s.pnl)}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--txt3)' }}>{s.trades}t · {wr.toFixed(0)}% WR</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Full table */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          Symbol Breakdown
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Symbol','Trades','Wins','Losses','Win Rate','Gross Win','Gross Loss','Net P&L'].map(h => (
                <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => {
              const wr = (s.wins / s.trades) * 100
              return (
                <tr key={i}>
                  <td style={{ padding: '8px 14px', fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '12px', borderBottom: '1px solid var(--brd)' }}>{s.symbol}</td>
                  <td style={{ padding: '8px 14px', fontSize: '11px', borderBottom: '1px solid var(--brd)' }}>{s.trades}</td>
                  <td style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--ac)', borderBottom: '1px solid var(--brd)' }}>{s.wins}</td>
                  <td style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{s.trades - s.wins}</td>
                  <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', color: wr >= 50 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{wr.toFixed(1)}%</td>
                  <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--ac)', borderBottom: '1px solid var(--brd)' }}>+${s.grossWin.toFixed(2)}</td>
                  <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--red)', borderBottom: '1px solid var(--brd)' }}>${s.grossLoss.toFixed(2)}</td>
                  <td style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: s.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{fmtPnl(s.pnl)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
