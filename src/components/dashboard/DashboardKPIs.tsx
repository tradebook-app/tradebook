'use client'
import { MetricCard } from '@/components/ui/MetricCard'
import type { KPIData } from '@/lib/types'
import { fmtPnl } from '@/lib/analytics'

type Props = {
  kpi: KPIData
  openCount: number
  openPnl: number
}

export function DashboardKPIs({ kpi, openCount, openPnl }: Props) {
  return (
    <>
      <style>{`
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }
        @media (max-width: 768px) {
          .kpi-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
        }
      `}</style>
      <div className="kpi-grid">
        <MetricCard
          label="Net P&L"
          value={fmtPnl(kpi.netPnl, true)}
          valueColor={kpi.netPnl >= 0 ? 'var(--ac)' : 'var(--red)'}
          sub={
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: 'var(--ac-d)', color: 'var(--ac)', fontFamily: 'var(--mono)' }}>
                +${(kpi.wins > 0 ? kpi.avgWin * kpi.wins : 0).toFixed(0)} gross
              </span>
              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: 'var(--red-d)', color: 'var(--red)', fontFamily: 'var(--mono)' }}>
                -${(kpi.losses > 0 ? kpi.avgLoss * kpi.losses : 0).toFixed(0)} loss
              </span>
            </div>
          }
          tooltip="Total realized profit and loss across all closed trades in the selected period."
        />
        <MetricCard
          label="Trade Win %"
          value={`${kpi.winRate.toFixed(1)}%`}
          sub={
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
              {[
                { label: `${kpi.wins}W`, bg: 'var(--ac-d)', color: 'var(--ac)' },
                { label: `${kpi.breakeven}BE`, bg: 'rgba(255,255,255,.06)', color: 'var(--txt3)' },
                { label: `${kpi.losses}L`, bg: 'var(--red-d)', color: 'var(--red)' },
              ].map((b, i) => (
                <span key={i} style={{ fontSize: '9px', fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: '10px', background: b.bg, color: b.color }}>{b.label}</span>
              ))}
            </div>
          }
          gauge={{ pct: kpi.winRate, color: kpi.winRate >= 50 ? 'var(--ac)' : 'var(--red)' }}
          tooltip="Percentage of closed trades that were winners, out of all wins, losses, and breakevens."
        />
        <MetricCard
          label="Profit Factor"
          value={kpi.profitFactor > 0 ? kpi.profitFactor.toFixed(2) : '—'}
          sub={
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: 'var(--ac-d)', color: 'var(--ac)', fontFamily: 'var(--mono)' }}>
                Avg W: +${kpi.avgWin.toFixed(0)}
              </span>
              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: 'var(--red-d)', color: 'var(--red)', fontFamily: 'var(--mono)' }}>
                Avg L: -${kpi.avgLoss.toFixed(0)}
              </span>
            </div>
          }
          gauge={{ pct: Math.min((kpi.profitFactor / 3) * 100, 100), color: kpi.profitFactor >= 1.5 ? 'var(--ac)' : 'var(--red)' }}
          tooltip="Gross profit ÷ Gross loss. Above 1.5 is solid."
        />
        <MetricCard
          label="Avg Win / Loss Ratio"
          value={kpi.avgWinLossRatio > 0 ? kpi.avgWinLossRatio.toFixed(2) : '—'}
          sub={
            openCount > 0
              ? <div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '3px' }}>
                  {openCount} open · {openPnl >= 0 ? '+' : ''}${openPnl.toFixed(0)} unrealized
                </div>
              : undefined
          }
          winLossBar={{ avgWin: kpi.avgWin, avgLoss: kpi.avgLoss }}
          tooltip="Average win size ÷ Average loss size"
        />
      </div>
    </>
  )
}
