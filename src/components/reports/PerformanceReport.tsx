'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades, calcKPIs, fmtPnl } from '@/lib/analytics'

type Props = { trades: TradeRow[] }

export function PerformanceReport({ trades }: Props) {
  const closed = closedTrades(trades)
  const kpi    = calcKPIs(trades)

  const grossWin  = closed.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(closed.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  const totalComm = closed.reduce((s, t) => s + (t.commission || 0), 0)
  const bestTrade = closed.length ? closed.reduce((a, b) => a.pnl > b.pnl ? a : b) : null
  const worstTrade = closed.length ? closed.reduce((a, b) => a.pnl < b.pnl ? a : b) : null
  const longTrades  = closed.filter(t => t.type === 'Long')
  const shortTrades = closed.filter(t => t.type === 'Short')
  const longWR  = longTrades.length  ? (longTrades.filter(t => t.pnl > 0).length  / longTrades.length)  * 100 : 0
  const shortWR = shortTrades.length ? (shortTrades.filter(t => t.pnl > 0).length / shortTrades.length) * 100 : 0
  const longPnl  = longTrades.reduce((s, t) => s + t.pnl, 0)
  const shortPnl = shortTrades.reduce((s, t) => s + t.pnl, 0)

  const ROWS = [
    ['Net P&L',          fmtPnl(kpi.netPnl),                     kpi.netPnl >= 0 ? 'var(--ac)' : 'var(--red)'],
    ['Gross Win',        `+$${grossWin.toFixed(2)}`,              'var(--ac)'],
    ['Gross Loss',       `-$${grossLoss.toFixed(2)}`,             'var(--red)'],
    ['Total Commission', `-$${totalComm.toFixed(2)}`,             'var(--orange)'],
    ['Profit Factor',    kpi.profitFactor.toFixed(2),             kpi.profitFactor >= 1.5 ? 'var(--ac)' : 'var(--red)'],
    ['Win Rate',         `${kpi.winRate.toFixed(1)}%`,            kpi.winRate >= 50 ? 'var(--ac)' : 'var(--red)'],
    ['Total Trades',     String(kpi.totalTrades),                 'var(--txt)'],
    ['Wins',             String(kpi.wins),                        'var(--ac)'],
    ['Losses',           String(kpi.losses),                      'var(--red)'],
    ['Breakeven',        String(kpi.breakeven),                   'var(--txt3)'],
    ['Avg Win',          `+$${kpi.avgWin.toFixed(2)}`,            'var(--ac)'],
    ['Avg Loss',         `-$${kpi.avgLoss.toFixed(2)}`,           'var(--red)'],
    ['Avg W/L Ratio',    kpi.avgWinLossRatio.toFixed(2),          kpi.avgWinLossRatio >= 1 ? 'var(--ac)' : 'var(--red)'],
    ['Best Trade',       bestTrade  ? fmtPnl(bestTrade.pnl)  + ` (${bestTrade.symbol})`  : '—', 'var(--ac)'],
    ['Worst Trade',      worstTrade ? fmtPnl(worstTrade.pnl) + ` (${worstTrade.symbol})` : '—', 'var(--red)'],
  ] as [string, string, string][]

  const SIDE_ROWS = [
    ['Long Trades',   String(longTrades.length),        'var(--txt)'],
    ['Long P&L',      fmtPnl(longPnl),                 longPnl >= 0 ? 'var(--ac)' : 'var(--red)'],
    ['Long Win Rate', `${longWR.toFixed(1)}%`,           longWR >= 50 ? 'var(--ac)' : 'var(--red)'],
    ['Short Trades',  String(shortTrades.length),        'var(--txt)'],
    ['Short P&L',     fmtPnl(shortPnl),                 shortPnl >= 0 ? 'var(--ac)' : 'var(--red)'],
    ['Short Win Rate',`${shortWR.toFixed(1)}%`,          shortWR >= 50 ? 'var(--ac)' : 'var(--red)'],
  ] as [string, string, string][]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      <Card title="Overall Performance">
        {ROWS.map(([label, val, color], i) => (
          <Row key={i} label={label} val={val} color={color} />
        ))}
      </Card>
      <Card title="Long vs Short">
        {SIDE_ROWS.map(([label, val, color], i) => (
          <Row key={i} label={label} val={val} color={color} />
        ))}
      </Card>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}

function Row({ label, val, color }: { label: string; val: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 18px', borderBottom: '1px solid var(--brd)' }}>
      <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color }}>{val}</span>
    </div>
  )
}
