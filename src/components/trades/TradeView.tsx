'use client'

import { useState, useMemo } from 'react'
import type { TradeRow, DateRangeFilter } from '@/lib/types'
import { filterByDate, closedTrades, calcKPIs, fmtPnl, fmtDate } from '@/lib/analytics'
import { MetricCard } from '@/components/ui/MetricCard'
import { TradePanel } from '@/components/trades/TradePanel'

type Props = {
  trades: TradeRow[]
  filter: DateRangeFilter
  onEdit: (trade: TradeRow) => void
  onDelete: (id: string) => void
  onDeleteFiltered: (ids: string[]) => void
}

export function TradeView({ trades, filter, onEdit, onDelete, onDeleteFiltered }: Props) {
  const [symFilter,   setSymFilter]   = useState('')
  const [stFilter,    setStFilter]    = useState('all')
  const [sideFilter,  setSideFilter]  = useState('all')
  const [setupFilter, setSetupFilter] = useState('all')
  const [fromFilter,  setFromFilter]  = useState('')
  const [toFilter,    setToFilter]    = useState('')
  const [selected,    setSelected]    = useState<TradeRow | null>(null)

  const setups = useMemo(() => {
    const s = new Set(trades.map(t => t.setup).filter(Boolean) as string[])
    return [...s].sort()
  }, [trades])

  const filtered = useMemo(() => {
    let r = filterByDate(closedTrades(trades), filter)
    if (symFilter)            r = r.filter(t => t.symbol.includes(symFilter.toUpperCase()))
    if (stFilter === 'win')   r = r.filter(t => t.pnl > 0)
    if (stFilter === 'loss')  r = r.filter(t => t.pnl < 0)
    if (stFilter === 'be')    r = r.filter(t => t.pnl === 0)
    if (sideFilter !== 'all') r = r.filter(t => t.type === sideFilter)
    if (setupFilter !== 'all') r = r.filter(t => t.setup === setupFilter)
    if (fromFilter) r = r.filter(t => t.date.substring(0, 10) >= fromFilter)
    if (toFilter)   r = r.filter(t => t.date.substring(0, 10) <= toFilter)
    return r.slice().reverse()
  }, [trades, filter, symFilter, stFilter, sideFilter, setupFilter, fromFilter, toFilter])

  const kpi = useMemo(() => calcKPIs(filterByDate(closedTrades(trades), filter)), [trades, filter])

  function handleDeleteFiltered() {
    const closed = trades.filter(t => t.exit && t.exit > 0)
    const opens  = trades.filter(t => !(t.exit && t.exit > 0))
    const isAll  = filtered.length === closed.length
    if (!filtered.length && opens.length === 0) return alert('No trades match current filters.')
    const ids = isAll ? trades.map(t => t.id) : filtered.map(t => t.id)
    const openNote = isAll && opens.length ? ` (including ${opens.length} open position${opens.length > 1 ? 's' : ''})` : ''
    const msg = isAll
      ? `⚠️ Delete ALL ${ids.length} trades${openNote}? This cannot be undone.`
      : `Delete ${ids.length} filtered trade${ids.length > 1 ? 's' : ''}? This cannot be undone.`
    if (!confirm(msg)) return
    onDeleteFiltered(ids)
  }

  const finput: React.CSSProperties = {
    background: 'var(--bg4)', border: '1px solid var(--brd2)',
    borderRadius: 'var(--r)', color: 'var(--txt)', fontSize: '11px',
    padding: '5px 9px', fontFamily: 'var(--sans)', outline: 'none',
  }

  const badgeBase: React.CSSProperties = {
    fontSize: '9px', fontWeight: 800, padding: '3px 0',
    borderRadius: '20px', display: 'inline-block', letterSpacing: '.04em',
    width: '46px', textAlign: 'center',
  }
  const badgeWin:  React.CSSProperties = { ...badgeBase, background: 'rgba(16,185,129,.18)', color: '#10B981', border: '1px solid rgba(16,185,129,.35)', textShadow: '0 0 8px rgba(16,185,129,.4)' }
  const badgeLoss: React.CSSProperties = { ...badgeBase, background: 'rgba(239,68,68,.18)',  color: '#EF4444', border: '1px solid rgba(239,68,68,.35)',  textShadow: '0 0 8px rgba(239,68,68,.4)' }
  const badgeBe:   React.CSSProperties = { ...badgeBase, background: 'rgba(245,158,11,.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,.3)',  textShadow: '0 0 8px rgba(245,158,11,.3)' }

  return (
    <>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
        <MetricCard label="Net P&L" value={fmtPnl(kpi.netPnl, true)} valueColor={kpi.netPnl >= 0 ? 'var(--ac)' : 'var(--red)'} />
        <MetricCard
          label="Trade Win %"
          value={`${kpi.winRate.toFixed(1)}%`}
          sub={
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
              {[
                { label: `${kpi.wins}W`, bg: 'var(--ac-d)', color: 'var(--ac)' },
                { label: `${kpi.breakeven}BE`, bg: 'rgba(255,255,255,.06)', color: 'var(--txt3)' },
                { label: `${kpi.losses}L`, bg: 'var(--red-d)', color: 'var(--red)' },
              ].map((b, i) => (
                <span key={i} style={{ fontSize: '9px', fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: '10px', background: b.bg, color: b.color }}>{b.label}</span>
              ))}
            </div>
          }
          gauge={{ pct: kpi.winRate, color: kpi.winRate >= 40 ? 'var(--ac)' : 'var(--red)' }}
        />
        <MetricCard label="Profit Factor" value={kpi.profitFactor.toFixed(2)} gauge={{ pct: Math.min(kpi.profitFactor / 3 * 100, 100), color: kpi.profitFactor >= 1.5 ? 'var(--ac)' : 'var(--red)' }} />
        <MetricCard
          label="Avg Win / Loss"
          value={kpi.avgWinLossRatio.toFixed(2)}
          sub={
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: '10px', background: 'var(--ac-d)', color: 'var(--ac)' }}>{fmtPnl(kpi.avgWin)}</span>
              <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: '10px', background: 'var(--red-d)', color: 'var(--red)' }}>-${kpi.avgLoss.toFixed(0)}</span>
            </div>
          }
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...finput, width: '80px', textTransform: 'uppercase' }} placeholder="Symbol..." value={symFilter} onChange={e => setSymFilter(e.target.value)} />
        <select style={finput} value={stFilter} onChange={e => setStFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="be">Breakeven</option>
        </select>
        <select style={finput} value={sideFilter} onChange={e => setSideFilter(e.target.value)}>
          <option value="all">All Sides</option>
          <option>Long</option>
          <option>Short</option>
        </select>
        <select style={finput} value={setupFilter} onChange={e => setSetupFilter(e.target.value)}>
          <option value="all">All Setups</option>
          {setups.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>From</span>
        <input style={finput} type="date" value={fromFilter} onChange={e => setFromFilter(e.target.value)} />
        <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>To</span>
        <input style={finput} type="date" value={toFilter} onChange={e => setToFilter(e.target.value)} />
        <button onClick={handleDeleteFiltered} style={{ marginLeft: 'auto', padding: '5px 12px', background: 'rgba(239,68,68,.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 'var(--r)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>🗑 Delete All</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Symbol</th><th>Status</th><th>Side</th><th>Setup</th>
              <th className="r">Entry</th><th className="r">Exit</th><th className="r">Shares</th>
              <th className="r">Net P&L</th><th className="r">ROI</th><th className="r">R</th>
              <th>Grade</th><th>Tags</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={14} className="empty">No trades found. Add your first trade using the "+ Add Trade" button.</td></tr>
            ) : filtered.map(t => {
              const roi = t.entry && t.shares ? (t.pnl / (t.entry * t.shares)) * 100 : 0
              const rm  = t.risk > 0 ? t.pnl / t.risk : null
              const isW = t.pnl > 0, isL = t.pnl < 0
              const isActive = selected?.id === t.id
              return (
                <tr key={t.id} style={{ cursor: 'pointer', background: isActive ? 'var(--ac-d2)' : undefined }} onClick={() => setSelected(t)}>
                  <td style={{ fontSize: '10px', color: 'var(--txt2)' }}>{fmtDate(t.date)}</td>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{t.symbol}</td>
                  <td><span style={isW ? badgeWin : isL ? badgeLoss : badgeBe}>{isW ? 'WIN' : isL ? 'LOSS' : 'BE'}</span></td>
                  <td style={{ fontSize: '11px' }}>{t.type}</td>
                  <td style={{ fontSize: '10px', color: 'var(--txt2)' }}>{t.setup || '—'}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{t.entry ? `$${t.entry}` : ''}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{t.exit ? `$${t.exit}` : '—'}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{t.shares || ''}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', color: isW ? 'var(--ac)' : isL ? 'var(--red)' : '', fontWeight: 600 }}>{fmtPnl(t.pnl)}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: roi >= 0 ? 'var(--ac)' : 'var(--red)' }}>{roi.toFixed(2)}%</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>{rm !== null ? `${rm.toFixed(2)}R` : '—'}</td>
                  <td style={{ fontSize: '11px' }}>{t.grade || '—'}</td>
                  <td>{(t.tags || []).map((tag, i) => <span key={i} className="tag">{tag}</span>)}</td>
                  <td>
                    <button className="btn-d" onClick={e => { e.stopPropagation(); if (confirm('Delete?')) onDelete(t.id) }} style={{ padding: '3px 8px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <TradePanel
        trade={selected}
        trades={filtered}
        onClose={() => setSelected(null)}
        onEdit={t => { setSelected(null); onEdit(t) }}
        onDelete={id => { onDelete(id); setSelected(null) }}
        onNavigate={t => setSelected(t)}
      />
    </>
  )
}
