'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades, fmtPnl } from '@/lib/analytics'
import { CumulativeChart } from '@/components/dashboard/CumulativeChart'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination, type Pagination as Pg } from '@/lib/usePagination'

type Props = { trades: TradeRow[] }

export function WinLossReport({ trades }: Props) {
  const closed = closedTrades(trades)
  const wins   = closed.filter(t => t.pnl > 0).sort((a, b) => b.pnl - a.pnl)
  const losses = closed.filter(t => t.pnl < 0).sort((a, b) => a.pnl - b.pnl)

  const winsPg   = usePagination(wins.length, 'sleek-rpt-winloss-w')
  const lossesPg = usePagination(losses.length, 'sleek-rpt-winloss-l')

  let curStreak = 0, maxWinStreak = 0, maxLossStreak = 0, maxBeStreak = 0, curType = ''
  ;[...closed].reverse().forEach(t => {
    const type = t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : 'be'
    if (type === curType) { curStreak++ } else { curStreak = 1; curType = type }
    if (type === 'win'  && curStreak > maxWinStreak)  maxWinStreak  = curStreak
    if (type === 'loss' && curStreak > maxLossStreak) maxLossStreak = curStreak
    if (type === 'be'   && curStreak > maxBeStreak)   maxBeStreak   = curStreak
  })

  const byGrade: Record<string, { pnl: number; trades: number; wins: number }> = {}
  closed.forEach(t => {
    const g = t.grade
    if (!g) return  // trades with no grade set don't appear in this box
    if (!byGrade[g]) byGrade[g] = { pnl: 0, trades: 0, wins: 0 }
    byGrade[g].pnl += t.pnl; byGrade[g].trades += 1
    if (t.pnl > 0) byGrade[g].wins += 1
  })

  // Two fixed columns so the box stays 3 rows tall however many grades are used.
  const gradeCols = [['A+', 'A', 'A-'], ['B', 'C']].map(col =>
    col.filter(g => byGrade[g]).map(g => ({ grade: g, ...byGrade[g] }))
  )
  const hasGrades = gradeCols.some(col => col.length > 0)

  const byDate  = closed.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const winSeq  = byDate.filter(t => t.pnl > 0)
  const lossSeq = byDate.filter(t => t.pnl < 0)
  let wr2 = 0; const wCum = winSeq.map(t => { wr2 += t.pnl; return wr2 })
  let lr2 = 0; const lCum = lossSeq.map(t => { lr2 += t.pnl; return lr2 })
  const wLabels = winSeq.map((_, i) => `#${i + 1}`)
  const lLabels = lossSeq.map((_, i) => `#${i + 1}`)

  const renderCard = (title: string, items: TradeRow[], pg: Pg) => (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden', flex: 1, minWidth: 0 }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>None yet</div>
      ) : (
        <>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '240px' }}>
            <thead>
              <tr>
                {['Symbol','Setup','P&L','R'].map(h => (
                  <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(pg.start, pg.end).map((t, i) => {
                const rm = t.risk > 0 ? t.pnl / t.risk : null
                return (
                  <tr key={i}>
                    <td style={{ padding: '7px 12px', fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '11px', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{t.symbol}</td>
                    <td style={{ padding: '7px 12px', fontSize: '10px', color: 'var(--txt3)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{t.setup || '—'}</td>
                    <td style={{ padding: '7px 12px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? 'var(--ac)' : 'var(--red)', fontSize: '11px', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{fmtPnl(t.pnl)}</td>
                    <td style={{ padding: '7px 12px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{rm !== null ? `${rm >= 0 ? '+' : ''}${rm.toFixed(1)}R` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 12px 2px' }}><Pagination pg={pg} itemLabel="trades" /></div>
        </>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>Streak Analysis</div>
          {[
            ['Max Win Streak',       `${maxWinStreak} in a row`,  'var(--ac)'],
            ['Max Loss Streak',      `${maxLossStreak} in a row`, 'var(--red)'],
            ['Max Breakeven Streak', `${maxBeStreak} in a row`,   'var(--txt)'],
          ].map(([l, v, c], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--brd)', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{l}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--mono)', color: c as string, whiteSpace: 'nowrap' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>Performance by Grade</div>
          {!hasGrades ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>No graded trades yet</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {gradeCols.map((col, ci) => (
                <div key={ci} style={{ borderLeft: ci > 0 && col.length > 0 ? '1px solid var(--brd)' : undefined }}>
                  {col.map((g, i) => {
                    const wr = (g.wins / g.trades) * 100
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--brd)', gap: '6px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ac2)', background: 'var(--ac-d)', padding: '1px 6px', borderRadius: '4px' }}>{g.grade}</span>
                          <span style={{ fontSize: '9px', color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{g.trades}t · {wr.toFixed(0)}%</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--mono)', color: g.pnl >= 0 ? 'var(--ac)' : 'var(--red)', whiteSpace: 'nowrap' }}>{fmtPnl(g.pnl)}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Best wins / Worst losses — stack on mobile */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {renderCard('Best Wins', wins, winsPg)}
        {renderCard('Worst Losses', losses, lossesPg)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>Cumulative P&amp;L (Wins)</div>
          <div style={{ padding: '14px 16px' }}><CumulativeChart labels={wLabels} data={wCum} /></div>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>Cumulative P&amp;L (Losses)</div>
          <div style={{ padding: '14px 16px' }}><CumulativeChart labels={lLabels} data={lCum} color="#EF4444" colorFade="rgba(239,68,68,.08)" /></div>
        </div>
      </div>
    </div>
  )
}
