'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades, fmtPnl, pickBestWorstDay, calcMaxDrawdown } from '@/lib/analytics'

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

  // Shared with the Dashboard drawdown chart (analytics.ts) so the two pages
  // can't disagree on "Max drawdown" for the same trades.
  const maxDD = calcMaxDrawdown(trades)

  let bStr = 0, wStr = 0, cW = 0, cL = 0
  closed.forEach(t => {
    if (t.pnl > 0) { cW++; cL = 0; bStr = Math.max(bStr, cW) }
    else if (t.pnl < 0) { cL++; cW = 0; wStr = Math.max(wStr, cL) }
    else { cW = 0; cL = 0 }
  })

  const byDay: Record<string, number> = {}
  closed.forEach(t => { const ds = (t.date || '').substring(0, 10); byDay[ds] = (byDay[ds] || 0) + t.pnl })
  const dayE = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]))
  const winDays  = dayE.filter(d => d[1] > 0)
  const lossDays = dayE.filter(d => d[1] < 0)

  // Largest single trade (not a day/week/month total)
  const best  = closed.length ? Math.max(...closed.map(t => t.pnl)) : 0
  const worst = closed.length ? Math.min(...closed.map(t => t.pnl)) : 0

  // Best / worst period. `worst` is null when there's only one of that period,
  // so it doesn't just echo `best` under a different label.
  const dayBW  = pickBestWorstDay(dayE.map(([, p]) => ({ pnl: p })))
  const bestDay = dayBW.best?.pnl ?? 0

  const byMo: Record<string, number> = {}
  closed.forEach(t => { const m = (t.date || '').substring(0, 7); byMo[m] = (byMo[m] || 0) + t.pnl })
  const moBW = pickBestWorstDay(Object.values(byMo).map(p => ({ pnl: p })))

  const weekKey = (ds: string) => {
    const d = new Date(ds + 'T12:00:00')
    const dow = d.getDay()
    const diff = (dow === 0 ? -6 : 1) - dow
    d.setDate(d.getDate() + diff)
    return d.toISOString().substring(0, 10)
  }
  const byWeek: Record<string, number> = {}
  closed.forEach(t => { const w = weekKey((t.date || '').substring(0, 10)); byWeek[w] = (byWeek[w] || 0) + t.pnl })
  const weekBW = pickBestWorstDay(Object.values(byWeek).map(p => ({ pnl: p })))

  const totalVol = closed.reduce((s, t) => s + (t.shares || 0), 0)
  const recovery = maxDD > 0 ? (pnl / maxDD).toFixed(2) : 'inf'

  const stats: [string, string][] = [
    ['Total P&L', fmtK(pnl)],
    ['Average winning trade', fmt(avgW)],
    ['Average losing trade', '-$' + avgL.toFixed(2)],
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
    ['Trading days', String(dayE.length)],
    ['Winning days', String(winDays.length)],
    ['Losing days', String(lossDays.length)],
    ['Avg daily P&L', fmt(dayE.length ? pnl / dayE.length : 0)],
    ['Best day P&L', fmt(bestDay)],
    ['Worst day P&L', dayBW.worst ? fmt(dayBW.worst.pnl) : '—'],
    ['Max drawdown', '-$' + maxDD.toFixed(2)],
    ['Avg R-multiple', avgRR.toFixed(2) + 'R'],
    ['Avg win day P&L', fmt(winDays.length ? winDays.reduce((s, d) => s + d[1], 0) / winDays.length : 0)],
    ['Avg loss day P&L', fmt(lossDays.length ? lossDays.reduce((s, d) => s + d[1], 0) / lossDays.length : 0)],
    ['Total trades volume', String(totalVol)],
    ['Avg daily volume', dayE.length ? (totalVol / dayE.length).toFixed(1) : '0'],
    ['Recovery factor', recovery],
  ]

  const periods: [string, number, number | null][] = [
    ['Day',   dayBW.best?.pnl ?? 0,  dayBW.worst?.pnl ?? null],
    ['Week',  weekBW.best?.pnl ?? 0, weekBW.worst?.pnl ?? null],
    ['Month', moBW.best?.pnl ?? 0,   moBW.worst?.pnl ?? null],
  ]

  // Split the metrics into two balanced columns (left takes the extra when odd).
  const half = Math.ceil(stats.length / 2)
  const statCols = [stats.slice(0, half), stats.slice(half)]

  if (closed.length === 0) {
    return <div style={{ padding: '30px', textAlign: 'center', color: 'var(--txt3)', fontSize: '12px' }}>No closed trades yet.</div>
  }

  return (
    <div>
      <div style={{ background: 'var(--bg4, #16161e)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>Your Stats</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {periods.map(([period, b, w], i) => (
            <div key={period} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px 0', borderBottom: i < periods.length - 1 ? '1px solid var(--brd)' : 'none' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '3px' }}>Best {period}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: b >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtK(b)}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '3px' }}>Worst {period}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: w === null ? 'var(--txt3)' : w >= 0 ? 'var(--ac)' : 'var(--red)' }}>{w === null ? '—' : fmtK(w)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .ov-stats-grid { display: grid; grid-template-columns: 1fr 1fr; }
        .ov-stats-grid > div:first-child { border-right: 1px solid var(--brd); }
        .ov-stats-grid > div > div { border-bottom: 1px solid var(--brd); }
        .ov-stats-grid > div > div:last-child { border-bottom: none; }
        @media (max-width: 720px) {
          .ov-stats-grid { grid-template-columns: 1fr; }
          .ov-stats-grid > div:first-child { border-right: none; }
          .ov-stats-grid > div:first-child > div:last-child { border-bottom: 1px solid var(--brd); }
        }
      `}</style>
      <div className="ov-stats-grid" style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        {statCols.map((col, ci) => (
          <div key={ci}>
            {col.map(([n, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{n}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--txt)', whiteSpace: 'nowrap' }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
