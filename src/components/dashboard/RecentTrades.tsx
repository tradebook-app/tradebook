'use client'

import type { TradeRow } from '@/lib/types'
import { fmtPnl, fmtDate } from '@/lib/analytics'

type Props = {
  trades: TradeRow[]
  onSelect: (trade: TradeRow) => void
}

export function RecentTrades({ trades, onSelect }: Props) {
  const recent = [...trades]
    .filter(t => t.exit && t.exit > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
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
        {recent.map(t => {
          const roi  = t.entry && t.shares ? (t.pnl / (t.entry * t.shares)) * 100 : 0
          const isW  = t.pnl > 0
          const isL  = t.pnl < 0
          return (
            <tr
              key={t.id}
              onClick={() => onSelect(t)}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '7px 10px', fontSize: '10px', color: 'var(--txt3)', borderBottom: '1px solid var(--brd)' }}>{fmtDate(t.date)}</td>
              <td style={{ padding: '7px 10px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.symbol}</td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--brd)' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: t.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)', color: t.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>
                  {t.type?.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '7px 10px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: isW ? 'var(--ac)' : isL ? 'var(--red)' : 'var(--txt3)', borderBottom: '1px solid var(--brd)' }}>
                {fmtPnl(t.pnl)}
              </td>
              <td style={{ padding: '7px 10px', fontSize: '10px', fontFamily: 'var(--mono)', color: roi >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>
                {roi.toFixed(2)}%
              </td>
              <td style={{ padding: '7px 10px', fontSize: '11px', color: 'var(--txt2)', borderBottom: '1px solid var(--brd)' }}>
                {t.grade || '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
