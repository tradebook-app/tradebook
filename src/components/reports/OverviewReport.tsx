'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades, fmtPnl } from '@/lib/analytics'

type Props = { trades: TradeRow[] }

const fmtK = (n: number) => fmtPnl(n, true)
const fmt  = (n: number) => fmtPnl(n)

export function OverviewReport({ trades }: Props) {
  const closed = closedTrades(trades).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const W  = closed.filter(t => t.pnl > 0)
  const L  = closed.filter(t => t.pnl < 0)
  const BE = closed.filter(t => t.pnl === 0)
  const pnl  = closed.reduce((s, t) => s + t.pnl, 0)
  const avgW = W.length ? W.reduce((s, t) => s + t.pnl, 0) / W.length : 0
  const avgL = L.length ? Math.abs(L.reduce((s, t) => s + t.pnl, 0) / L.length) : 0
  const pf   = avgL > 0 ? (avgW * W.length) / (avgL * L.length) : avgW > 0 ? avgW * W.length : 0
  const rT   = closed.filter(t => t.risk > 0)
  const avgRR = rT.length ? rT.reduce((s, t) => s + t.pnl / t.risk, 0) / rT.length : 0
  const exp  = closed.length ? pnl / closed.length : 0

  // Drawdown
  let peak = 0, maxDD = 0, run = 0
  closed.forEach(t => { run += t.pnl; if (run > peak) peak = run; if (peak - run > maxDD) maxDD = peak - run })

  // Streaks
  let bStr = 0, wStr = 0, cW = 0, cL = 0
  closed.forEach(t => {
    if (t.pnl > 0) { cW++; cL = 0; bStr = Math.max(bStr, cW) }
    else if (t.pnl < 0) { cL++; cW = 0; wStr = Math.max(wStr, cL) }
    else { cW = 0; cL = 0 }
  })

  // By day
  const byDay: Record<string, number> = {}
  closed.forEach(t => { const ds = (t.date || '').substring(0, 10); byDay[ds] = (byDay[ds] || 0) + t.pnl })
  const dayE = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]))
  const winDays  = dayE.filter(d => d[1] > 0)
  const lossDays = dayE.filter(d => d[1] < 0)

  const best  = closed.length ? Math.max(...closed.map(t => t.pnl)) : 0
  const worst = closed.length ? Math.min(...closed.map(t => t.pnl)) : 0
  const bestDay  = dayE.length ? Math.max(...dayE.map(d => d[1])) : 0
  const worstDay = dayE.length ? Math.min(...dayE.map(d => d[1])) : 0

  // By month
  const byMo: Record<string, number> = {}
  closed.forEach(t => { const m = (t.date || '').substring(0, 7); byMo[m] = (byMo[m] || 0) + t.pnl })
  const moE = Object.entries(byMo).sort((a, b) => a[0].localeCompare(b[0]))
  const bestMo  = moE.length ? moE.reduce((a, b) => (a[1] > b[1] ? a : b)) : ['—', 0] as [string, number]
  const worstMo = moE.length ? moE.reduce((a, b) => (a[1] < b[1] ? a : b)) : ['—', 0] as [string, number]

  const totalVol = closed.reduce((s, t) => s + (t.shares || 0), 0)
  const recovery = maxDD > 0 ? (pnl / maxDD).toFixed(2) : '∞'

  const left: [string, string][] = [
    ['Total P&L', fmtK(pnl)],
    ['Average winning trade', fmt(avgW)],
    ['Average losing trade', `-$${avgL.toFixed(2)}`],
    ['Total trades', String(closed.length)],
    ['Winning trades', String(W.length)],
    ['Losing trades', String(L.length)],
    ['Breakeven trades', String(BE.length)],
    ['Max consecutive wins', String(bStr)],
    ['Max consecutive losses', String(wStr)],
    ['Largest profit', fmt(best)],
    ['Largest loss', fmt(worst)],
    ['Profit factor', pf.toFixed(2)],
    ['Trade expectancy', fmt(exp)],
  ]
  const right: [string, string][] = [
    ['Trading days', String(dayE.length)],
    ['Winning days', String(winDays.length)],
    ['Losing days', String(lossDays.length)],
    ['Avg daily P&L', fmt(dayE.length ? pnl / dayE.length : 0)],
    ['Best day P&L', fmt(bestDay)],
    ['Worst day P&L', fmt(worstDay)],
    ['Max drawdown', `-$${maxDD.toFixed(2)}`],
    ['Avg R-multiple', `${avgRR.toFixed(2)}R`],
    ['Avg win day P&L', fmt(winDays.length ? winDays.reduce((s, d) => s + d[1], 0) / winDays.length : 0)],
    ['Avg loss day P&L', fmt(lossDays.length ? lossDays.reduce((s, d) => s + d[1], 0) / lossDays.length : 0)],
    ['Total trades volume', String(totalVol)],
    ['Avg daily volume', dayE.length ? (totalVol / dayE.length).toFixed(1) : '0'],
    ['Recovery factor', recovery],
  ]

  const monthLabel = (m: string) => {
    if (m === '—') return '—'
    const [y, mo] = m.split('-')
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${names[parseInt(mo, 10) - 1]} ${y}`
  }

  const topCard = (label: string, value: string, sub: string) => (
    <div>
      <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--mono)' }}>{value}</div>
      <div style={{ fontSize: '8px', color: 'var(--txt3)' }}>{sub}</div>
    </div>
  )

  const StatCol = ({ rows, borderRight }: { rows: [string, string][]; borderRight?: boolean }) => (
    <div style={{ borderRight: borderRight ? '1px solid var(--brd)' : 'none' }}>
      {rows.map(([n, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 18px', borderBottom: '1px solid var(--brd)' }}>
          <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{n}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--txt)' }}>{v}</span>
        </div>
      ))}
    </div>
  )

  if (closed.length === 0) {
    return <div style={{ padding: '30px', textAlign: 'center', color: 'var(--txt3)', fontSize: '12px' }}>No closed trades yet.</div>
  }

  return (
    <div>
      {/* Best/Worst month */}
      <div style={{ background: 'var(--bg4, #16161e)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px' }}>Your Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {topCard('Best month', fmtK(bestMo[1] as number), monthLabel(bestMo[0] as string))}
          {topCard('Worst month', fmtK(worstMo[1] as number), monthLabel(worstMo[0] as string))}
          {topCard('Average', fmtK(moE.length ? pnl / moE.length : 0), 'per month')}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <StatCol rows={left} borderRight />
        <StatCol rows={right} />
      </div>
    </div>
  )
}
