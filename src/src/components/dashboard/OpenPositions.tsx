'use client'

import type { TradeRow } from '@/lib/types'
import { fmtDate } from '@/lib/analytics'

type Props = {
  trades: TradeRow[]
  onSelect: (t: TradeRow) => void
}

export function OpenPositions({ trades, onSelect }: Props) {
  const open = trades.filter(t => !t.exit || t.exit === 0)

  if (!open.length) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>
        No open positions
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {['Symbol','Side','Entry','Date','Risk'].map(h => (
            <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {open.map(t => (
          <tr
            key={t.id}
            onClick={() => onSelect(t)}
            style={{ cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <td style={{ padding: '7px 10px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{t.symbol}</td>
            <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--brd)' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: t.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)', color: t.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>
                {t.type?.toUpperCase()}
              </span>
            </td>
            <td style={{ padding: '7px 10px', fontSize: '11px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>${t.entry}</td>
            <td style={{ padding: '7px 10px', fontSize: '10px', color: 'var(--txt3)', borderBottom: '1px solid var(--brd)' }}>{fmtDate(t.date)}</td>
            <td style={{ padding: '7px 10px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--orange)', borderBottom: '1px solid var(--brd)' }}>${t.risk || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
