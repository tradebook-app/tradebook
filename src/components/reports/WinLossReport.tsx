'use client'

import { useState } from 'react'
import type { TradeRow, DateRangeFilter } from '@/lib/types'
import { closedTrades, fmtPnl, filterByDate } from '@/lib/analytics'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination, type Pagination as Pg } from '@/lib/usePagination'
import { DateRangePicker } from '@/components/layout/DateRangePicker'

type Props = {
  trades: TradeRow[]      // page-filtered by the global date picker
  allTrades: TradeRow[]   // raw, unfiltered — for the chart's own local date picker
}

// P&L-size buckets for the Win/Loss Size Distribution histogram (mirrored for
// wins and losses — a trade is placed by the absolute size of its P&L).
const SIZE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '$0–50',    min: 0,    max: 50 },
  { label: '$50–100',  min: 50,   max: 100 },
  { label: '$100–250', min: 100,  max: 250 },
  { label: '$250–500', min: 250,  max: 500 },
  { label: '$500–1k',  min: 500,  max: 1000 },
  { label: '$1k+',     min: 1000, max: Infinity },
]

export function WinLossReport({ trades, allTrades }: Props) {
  // Date range for the Win/Loss Size Distribution chart only — a local filter so
  // it doesn't touch the rest of the page (which stays on the `trades` prop).
  const [sizeFilter, setSizeFilter] = useState<DateRangeFilter>({ range: 'all' })

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
  const [gradeColA, gradeColB] = [['A+', 'A', 'A-'], ['B', 'C']].map(col =>
    col.filter(g => byGrade[g]).map(g => ({ grade: g, ...byGrade[g] }))
  )
  const hasGrades   = gradeColA.length > 0 || gradeColB.length > 0
  // Only split into two columns when both actually have rows; otherwise a single
  // full-width column so an empty B/C column doesn't leave a dead gap.
  const splitGrades = gradeColA.length > 0 && gradeColB.length > 0

  // Win/Loss size distribution — filters the RAW trades by its own local picker,
  // so it's fully independent of the page-level global date filter.
  const sizeClosed = closedTrades(filterByDate(allTrades, sizeFilter))
  const sizeWins   = sizeClosed.filter(t => t.pnl > 0)
  const sizeLosses = sizeClosed.filter(t => t.pnl < 0)
  const sizeDist = SIZE_BUCKETS.map(b => ({
    label:  b.label,
    wins:   sizeWins.filter(t => t.pnl >= b.min && t.pnl < b.max).length,
    losses: sizeLosses.filter(t => -t.pnl >= b.min && -t.pnl < b.max).length,
  }))
  const maxBucket = Math.max(1, ...sizeDist.flatMap(d => [d.wins, d.losses]))

  // Caption read from the bucket data: is the bulk of losses in bigger $ buckets
  // than the bulk of wins (bad), the reverse (good), or neither (neutral)?
  const avgBucketIndex = (side: 'wins' | 'losses') => {
    let sum = 0, n = 0
    sizeDist.forEach((d, i) => { sum += d[side] * i; n += d[side] })
    return n ? sum / n : 0
  }
  const sizeSkew = (() => {
    if (sizeWins.length === 0)   return 'No winning trades in this range.'
    if (sizeLosses.length === 0) return 'No losing trades in this range.'
    if (sizeWins.length < 3 || sizeLosses.length < 3) return 'Not enough trades yet to read a clear size pattern.'
    const diff = avgBucketIndex('wins') - avgBucketIndex('losses')
    if (diff <= -0.5) return 'Losses skew into larger buckets than wins — watch for cutting winners short / letting losers run.'
    if (diff >=  0.5) return 'Wins skew into larger buckets than losses — good risk discipline.'
    return 'Wins and losses sit in similar size ranges — no strong skew either way.'
  })()

  const gradeRow = (g: { grade: string; pnl: number; trades: number; wins: number }, i: number) => {
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
  }

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
          ) : splitGrades ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div>{gradeColA.map(gradeRow)}</div>
              <div style={{ borderLeft: '1px solid var(--brd)' }}>{gradeColB.map(gradeRow)}</div>
            </div>
          ) : (
            <div>{[...gradeColA, ...gradeColB].map(gradeRow)}</div>
          )}
        </div>
      </div>

      {/* Best wins / Worst losses — stack on mobile */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {renderCard('Best Wins', wins, winsPg)}
        {renderCard('Worst Losses', losses, lossesPg)}
      </div>

      {/* overflow visible so the date picker's menu (opening upward) isn't clipped */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)' }}>
        <div style={{ padding: '9px 12px 9px 18px', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>Win/Loss Size Distribution</div>
          <DateRangePicker filter={sizeFilter} onFilterChange={setSizeFilter} align="up" />
        </div>
        {sizeClosed.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>No closed trades in this range</div>
        ) : (
          <div style={{ padding: '14px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 82px 1fr', fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px' }}>
              <span style={{ textAlign: 'right', color: 'var(--red)' }}>◀ Losses ({sizeLosses.length})</span>
              <span style={{ textAlign: 'center' }}>Size</span>
              <span style={{ color: 'var(--ac)' }}>Wins ({sizeWins.length}) ▶</span>
            </div>
            {sizeDist.map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 82px 1fr', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  {d.losses > 0 && <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--txt3)' }}>{d.losses}</span>}
                  <div style={{ width: `${(d.losses / maxBucket) * 100}%`, minWidth: d.losses > 0 ? '3px' : '0', height: '15px', background: 'linear-gradient(90deg, var(--bar-red-2), var(--bar-red-1))', borderRadius: '3px 0 0 3px' }} />
                </div>
                <div style={{ textAlign: 'center', fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--txt2)', borderLeft: '1px solid var(--brd2)', borderRight: '1px solid var(--brd2)', padding: '3px 4px' }}>{d.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px' }}>
                  <div style={{ width: `${(d.wins / maxBucket) * 100}%`, minWidth: d.wins > 0 ? '3px' : '0', height: '15px', background: 'linear-gradient(90deg, var(--bar-green-1), var(--bar-green-2))', borderRadius: '0 3px 3px 0' }} />
                  {d.wins > 0 && <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--txt3)' }}>{d.wins}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: '9px', color: 'var(--txt3)', padding: '0 18px 14px' }}>
          Trades bucketed by P&amp;L size. {sizeSkew}
        </div>
      </div>
    </div>
  )
}
