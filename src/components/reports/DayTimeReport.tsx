'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades, fmtPnl } from '@/lib/analytics'

type Props = { trades: TradeRow[] }

const DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS  = Array.from({ length: 24 }, (_, i) => i)

type DayBucket  = { pnl: number; trades: number; wins: number }

export function DayTimeReport({ trades }: Props) {
  const closed = closedTrades(trades)

  // Day of week stats
  const byDow: DayBucket[] = DAYS.map(() => ({ pnl: 0, trades: 0, wins: 0 }))
  closed.forEach(t => {
    const dow = new Date(t.date).getDay()
    byDow[dow].pnl    += t.pnl
    byDow[dow].trades += 1
    if (t.pnl > 0) byDow[dow].wins += 1
  })

  // Hour of day stats
  const byHour: DayBucket[] = HOURS.map(() => ({ pnl: 0, trades: 0, wins: 0 }))
  closed.forEach(t => {
    const hr = new Date(t.date).getHours()
    byHour[hr].pnl    += t.pnl
    byHour[hr].trades += 1
    if (t.pnl > 0) byHour[hr].wins += 1
  })

  const maxDowPnl  = Math.max(...byDow.map(d => Math.abs(d.pnl)), 1)
  const activeHours = byHour.filter(h => h.trades > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Day of Week */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          Performance by Day of Week
        </div>
        <div style={{ padding: '16px 18px' }}>
          {byDow.map((d, i) => {
            if (i === 0 || i === 6) return null // Skip weekends if no data
            const wr   = d.trades ? (d.wins / d.trades) * 100 : 0
            const barW = d.trades ? (Math.abs(d.pnl) / maxDowPnl) * 100 : 0
            const isPos = d.pnl >= 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '80px', fontSize: '11px', color: 'var(--txt2)', flexShrink: 0 }}>{DAYS[i]}</div>
                <div style={{ flex: 1, height: '22px', background: 'var(--bg4)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${barW}%`, height: '100%',
                    background: isPos ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)',
                    borderRadius: '4px',
                    transition: 'width .3s',
                  }} />
                  {d.trades > 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: '8px', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', fontWeight: 700, color: isPos ? 'var(--ac)' : 'var(--red)' }}>
                        {fmtPnl(d.pnl)}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--txt3)' }}>{d.trades}t · {wr.toFixed(0)}% WR</span>
                    </div>
                  )}
                  {d.trades === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--txt4)' }}>No trades</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Hour of Day */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
          Performance by Hour of Day
        </div>
        {activeHours.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>No data yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Hour', 'Trades', 'Win Rate', 'Net P&L', 'Avg P&L'].map(h => (
                  <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byHour.map((h, i) => {
                if (!h.trades) return null
                const wr  = (h.wins / h.trades) * 100
                const avg = h.pnl / h.trades
                const fmt12 = (hr: number) => {
                  const suffix = hr >= 12 ? 'PM' : 'AM'
                  const h12   = hr % 12 || 12
                  return `${h12}:00 ${suffix}`
                }
                return (
                  <tr key={i}>
                    <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>{fmt12(i)}</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', borderBottom: '1px solid var(--brd)' }}>{h.trades}</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', color: wr >= 50 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{wr.toFixed(0)}%</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', fontWeight: 700, color: h.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{fmtPnl(h.pnl)}</td>
                    <td style={{ padding: '8px 14px', fontSize: '11px', fontFamily: 'var(--mono)', color: avg >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{fmtPnl(avg)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
