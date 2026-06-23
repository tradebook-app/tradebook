'use client'
import type { TradeRow } from '@/lib/types'
import { closedTrades, calcSymbolStats, fmtPnl } from '@/lib/analytics'
import { VerticalBars } from './VerticalBars'
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
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          P&L by Symbol
        </div>
        <div style={{ padding: '16px 18px' }}>
          <VerticalBars items={stats.slice(0, 15).map(s => ({
            label: s.symbol,
            value: s.pnl,
            sub: `${s.trades}t · ${((s.wins / s.trades) * 100).toFixed(0)}% WR`,
          }))} />
        </div>
        <div style={{ fontSize: '9px', color: 'var(--txt3)', padding: '0 18px 14px' }}>
          t = trades · WR = win rate
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          Symbol Breakdown
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
            <thead>
              <tr>
                {['Symbol','Trades','Wins','Losses','Win Rate','Gross Win','Gross Loss','Net P&L'].map(h => (
                  <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const wr = (s.wins / s.trades) * 100
                return (
                  <tr key={i}>
                    <td style={{ padding: '8px 14px', fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '12px', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{s.symbol}</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', borderBottom: '1px solid var(--brd)' }}>{s.trades}</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--ac)', borderBottom: '1px solid var(--brd)' }}>{s.wins}</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{s.trades - s.wins}</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', color: wr >= 50 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{wr.toFixed(1)}%</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--ac)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>+${s.grossWin.toFixed(2)}</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>${s.grossLoss.toFixed(2)}</td>
                    <td style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: s.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{fmtPnl(s.pnl)}</td>
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
