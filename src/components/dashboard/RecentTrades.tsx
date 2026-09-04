'use client'

import type { TradeRow } from '@/lib/types'
import { fmtPnl, fmtDate, tradeRoi } from '@/lib/analytics'

type Props = {
  trades: TradeRow[]
  onSelect: (trade: TradeRow) => void
}

type GroupedRow = {
  key: string
  legs: TradeRow[]
  isGroup: boolean
  symbol: string
  type: 'Long' | 'Short'
  asset_type: TradeRow['asset_type']
  sortDate: string
  avgEntry: number
  totalShares: number
  totalPnl: number
  grade: string | null
}

function buildGroupedRows(trades: TradeRow[]): GroupedRow[] {
  const groups: Record<string, TradeRow[]> = {}
  const singles: TradeRow[] = []

  for (const t of trades) {
    if (t.trade_group_id) {
      if (!groups[t.trade_group_id]) groups[t.trade_group_id] = []
      groups[t.trade_group_id].push(t)
    } else {
      singles.push(t)
    }
  }

  const rows: GroupedRow[] = []

  for (const legs of Object.values(groups)) {
    const sortedByExit = [...legs].sort((a, b) => (a.exit_date || a.date).localeCompare(b.exit_date || b.date))
    const totalShares = legs.reduce((s, l) => s + l.shares, 0)
    const totalCost = legs.reduce((s, l) => s + l.entry * l.shares, 0)
    const lastLeg = sortedByExit[sortedByExit.length - 1]

    rows.push({
      key: legs[0].trade_group_id as string,
      legs: sortedByExit,
      isGroup: legs.length > 1,
      symbol: legs[0].symbol,
      type: legs[0].type,
      asset_type: legs[0].asset_type,
      sortDate: (lastLeg.exit_date || lastLeg.date),
      avgEntry: totalShares > 0 ? totalCost / totalShares : 0,
      totalShares,
      totalPnl: legs.reduce((s, l) => s + l.pnl, 0),
      grade: lastLeg?.grade ?? null,
    })
  }

  for (const t of singles) {
    rows.push({
      key: t.id,
      legs: [t],
      isGroup: false,
      symbol: t.symbol,
      type: t.type,
      asset_type: t.asset_type,
      sortDate: (t.exit_date || t.date),
      avgEntry: t.entry,
      totalShares: t.shares,
      totalPnl: t.pnl,
      grade: t.grade,
    })
  }

  return rows
}

export function RecentTrades({ trades, onSelect }: Props) {
  const closed = trades.filter(t => t.exit && t.exit > 0)
  const recent = buildGroupedRows(closed)
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
    .slice(0, 8)

  if (!recent.length) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>
        No closed trades yet
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {['Date','Symbol','Side','P&L','ROI','Grade'].map(h => (
            <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {recent.map(row => {
          // Uses the same cost-basis math as P&L (options ×100, futures ×point
          // value, forex ×lot size) — previously divided by raw entry×shares,
          // inflating options ROI by ~100x. null when the multiplier can't be
          // determined; rendered as '—' rather than a wrong number.
          const roi  = tradeRoi({ entry: row.avgEntry, shares: row.totalShares, pnl: row.totalPnl, asset_type: row.asset_type, symbol: row.symbol })
          const isW  = row.totalPnl > 0
          const isL  = row.totalPnl < 0
          return (
            <tr
              key={row.key}
              onClick={() => onSelect(row.legs[row.legs.length - 1])}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '7px 10px', fontSize: '10px', color: 'var(--txt3)', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{fmtDate(row.sortDate)}</td>
              <td style={{ padding: '7px 10px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>
                {row.symbol}
                {row.isGroup && (
                  <span style={{ marginLeft: '6px', fontSize: '8px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg4)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '1px 5px' }}>
                    {row.legs.length}x
                  </span>
                )}
              </td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--brd)' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: row.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)', color: row.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>
                  {row.type?.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '7px 10px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: isW ? 'var(--ac)' : isL ? 'var(--red)' : 'var(--txt3)', borderBottom: '1px solid var(--brd)' }}>
                {fmtPnl(row.totalPnl)}
              </td>
              <td style={{ padding: '7px 10px', fontSize: '10px', fontFamily: 'var(--mono)', color: roi == null ? 'var(--txt3)' : roi >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>
                {roi == null ? '—' : `${roi.toFixed(2)}%`}
              </td>
              <td style={{ padding: '7px 10px', fontSize: '11px', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)' }}>
                {row.grade || '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
