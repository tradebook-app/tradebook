'use client'

import type { TradeRow } from '@/lib/types'
import { closedTrades, fmtPnl, fmtProfitFactor, normalizeSetupName } from '@/lib/analytics'
import { VerticalBars } from './VerticalBars'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/lib/usePagination'

type Props = { trades: TradeRow[] }

export function SetupReport({ trades }: Props) {
  const closed = closedTrades(trades)

  const bySetup: Record<string, { label: string; pnl: number; trades: number; wins: number; losses: number; grossWin: number; grossLoss: number }> = {}
  closed.forEach(t => {
    const raw = (t.setup || '').trim()
    if (!raw) return  // trades with no setup assigned don't appear here
    // Group by a normalized name (case + whitespace folded) so "Bull Flag",
    // "bull flag" and "Bull  Flag" from manual entry / imports / legacy trades
    // don't fragment one setup's stats across several rows.
    const key = normalizeSetupName(raw)
    if (!key) return
    if (!bySetup[key]) bySetup[key] = { label: raw, pnl: 0, trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0 }
    bySetup[key].pnl    += t.pnl
    bySetup[key].trades += 1
    // A breakeven trade (pnl === 0) is neither a win nor a loss — it used to
    // fall into the `else` branch and get counted as a loss.
    if (t.pnl > 0)      { bySetup[key].wins++;   bySetup[key].grossWin  += t.pnl }
    else if (t.pnl < 0) { bySetup[key].losses++; bySetup[key].grossLoss += t.pnl }
  })

  const rows = Object.entries(bySetup)
    .map(([, s]) => ({
      setup: s.label, ...s,
      wr: s.trades ? (s.wins / s.trades) * 100 : 0,
      // A ratio (gross win ÷ gross loss); with wins and no losses that's
      // mathematically infinite, not the raw dollar amount of the wins.
      pf: s.grossLoss < 0 ? s.grossWin / Math.abs(s.grossLoss) : s.grossWin > 0 ? Infinity : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl)

  // resetKey: trades — see SymbolsReport for why totalItems alone isn't
  // enough (a filter change whose new row count matches the old one).
  const pg = usePagination(rows.length, 'sleek-rpt-setups', trades)
  const pageRows = rows.slice(pg.start, pg.end)

  if (!rows.length) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px' }}>
        No closed trades yet. Add setups when logging trades to see strategy analysis.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>P&L by Setup</div>
        <div style={{ padding: '16px 18px' }}>
          <VerticalBars items={rows.map(r => ({
            label: r.setup,
            value: r.pnl,
            sub: `${r.trades} trades · ${r.wr.toFixed(0)}% WR · ${fmtProfitFactor(r.pf)} PF`,
          }))} />
        </div>
        <div style={{ fontSize: '9px', color: 'var(--txt3)', padding: '0 18px 14px' }}>
          WR = win rate · PF = profit factor (gross win / gross loss)
        </div>
      </div>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>Setup Breakdown</div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr>
                {['Setup','Trades','W','L','Win Rate','Profit Factor','Gross Win','Gross Loss','Net P&L'].map(h => (
                  <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{r.setup}</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', borderBottom: '1px solid var(--brd)' }}>{r.trades}</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--ac)', borderBottom: '1px solid var(--brd)' }}>{r.wins}</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--red)', borderBottom: '1px solid var(--brd)' }}>{r.losses}</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--mono)', color: r.wr >= 50 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{r.wr.toFixed(1)}%</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--mono)', color: r.pf >= 1.5 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{fmtProfitFactor(r.pf)}</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--ac)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>+${r.grossWin.toFixed(0)}</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>${Math.abs(r.grossLoss).toFixed(0)}</td>
                  <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: r.pnl >= 0 ? 'var(--ac)' : 'var(--red)', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{fmtPnl(r.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 18px 4px' }}><Pagination pg={pg} itemLabel="setups" /></div>
      </div>
    </div>
  )
}
