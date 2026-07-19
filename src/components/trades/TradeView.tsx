'use client'

import { useState, useMemo } from 'react'
import type { TradeRow, DateRangeFilter } from '@/lib/types'
import { assetUnitLabel } from '@/lib/types'
import { filterByDate, closedTrades, calcKPIs, fmtPnl, fmtDate } from '@/lib/analytics'
import { MetricCard } from '@/components/ui/MetricCard'
import { TradePanel } from '@/components/trades/TradePanel'
import { DateRangePicker } from '@/components/layout/DateRangePicker'
import { FilterDropdown } from '@/components/ui/FilterDropdown'

type Props = {
  trades: TradeRow[]
  filter: DateRangeFilter
  onFilterChange: (f: DateRangeFilter) => void
  onEdit: (trade: TradeRow) => void
  onDelete: (id: string) => void
  onDeleteFiltered: (ids: string[]) => void
}

type GroupedRow = {
  key: string
  legs: TradeRow[]
  isGroup: boolean
  symbol: string
  type: 'Long' | 'Short'
  date: string
  totalShares: number
  avgEntry: number
  lastExit: number | null
  totalPnl: number
  totalRisk: number
  grade: string | null
  setup: string | null
  tags: string[]
}

function fmtLegMoment(iso: string): string {
  const d = new Date(iso)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0
  if (!hasTime) return dateStr
  const timeStr = d.toLocaleTimeString('en-US', { hour12: false })
  return `${dateStr} · ${timeStr}`
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
    const sortedByDate = [...legs].sort((a, b) => a.date.localeCompare(b.date))
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
      date: sortedByDate[0].date,
      totalShares,
      avgEntry: totalShares > 0 ? totalCost / totalShares : 0,
      lastExit: lastLeg?.exit ?? null,
      totalPnl: legs.reduce((s, l) => s + l.pnl, 0),
      totalRisk: legs.reduce((s, l) => s + (l.risk || 0), 0),
      grade: lastLeg?.grade ?? null,
      setup: lastLeg?.setup ?? null,
      tags: lastLeg?.tags || [],
    })
  }

  for (const t of singles) {
    rows.push({
      key: t.id,
      legs: [t],
      isGroup: false,
      symbol: t.symbol,
      type: t.type,
      date: t.date,
      totalShares: t.shares,
      avgEntry: t.entry,
      lastExit: t.exit,
      totalPnl: t.pnl,
      totalRisk: t.risk || 0,
      grade: t.grade,
      setup: t.setup,
      tags: t.tags || [],
    })
  }

  rows.sort((a, b) => b.date.localeCompare(a.date))
  return rows
}

export function TradeView({ trades, filter, onFilterChange, onEdit, onDelete, onDeleteFiltered }: Props) {
  const [symFilter,   setSymFilter]   = useState('')
  const [stFilter,    setStFilter]    = useState('all')
  const [sideFilter,  setSideFilter]  = useState('all')
  const [setupFilter, setSetupFilter] = useState('all')
  const [selected,    setSelected]    = useState<TradeRow | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleDeleteGroup(row: GroupedRow) {
    if (row.legs.length === 1) {
      if (confirm('Delete?')) onDelete(row.legs[0].id)
      return
    }
    if (confirm(`Delete this trade and all ${row.legs.length} exits? This cannot be undone.`)) {
      onDeleteFiltered(row.legs.map(l => l.id))
    }
  }

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
    return r.slice().reverse()
  }, [trades, filter, symFilter, stFilter, sideFilter, setupFilter])

  const kpi = useMemo(() => calcKPIs(filterByDate(closedTrades(trades), filter)), [trades, filter])

  const groupedFiltered = useMemo(() => buildGroupedRows(filtered), [filtered])

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
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: '999px',
          padding: '0 14px', height: '32px', boxSizing: 'border-box',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            style={{
              background: 'none', border: 'none', outline: 'none', color: 'var(--txt)',
              fontSize: '11.5px', fontWeight: 600, fontFamily: 'var(--sans)',
              textTransform: 'uppercase', width: '78px', padding: 0, height: '100%',
              lineHeight: 'normal',
            }}
            placeholder="Symbol..."
            value={symFilter}
            onChange={e => setSymFilter(e.target.value)}
          />
        </div>
        <FilterDropdown
          value={stFilter}
          onChange={setStFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'win', label: 'Wins' },
            { value: 'loss', label: 'Losses' },
            { value: 'be', label: 'Breakeven' },
          ]}
        />
        <FilterDropdown
          value={sideFilter}
          onChange={setSideFilter}
          options={[
            { value: 'all', label: 'All Sides' },
            { value: 'Long', label: 'Long' },
            { value: 'Short', label: 'Short' },
          ]}
        />
        <FilterDropdown
          value={setupFilter}
          onChange={setSetupFilter}
          options={[{ value: 'all', label: 'All Setups' }, ...setups.map(s => ({ value: s, label: s }))]}
        />
        <DateRangePicker filter={filter} onFilterChange={onFilterChange} />
        <button onClick={handleDeleteFiltered} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '32px', boxSizing: 'border-box', background: 'rgba(239,68,68,.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>🗑 Delete All</button>
      </div>

      {/* Table — desktop/tablet only, see .mobile-trade-cards below for phone */}
      <div className="desktop-table-wrap" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Symbol</th><th>Status</th><th>Side</th><th>Setup</th>
              <th className="r">Entry</th><th className="r">Exit</th><th className="r">Size</th>
              <th className="r">Net P&L</th><th className="r">ROI</th><th className="r">R</th>
              <th>Grade</th><th>Tags</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={14} className="empty">No trades found. Add your first trade using the "+ Add Trade" button.</td></tr>
            ) : groupedFiltered.map(row => {
              const roi = row.avgEntry && row.totalShares ? (row.totalPnl / (row.avgEntry * row.totalShares)) * 100 : 0
              const rm  = row.totalRisk > 0 ? row.totalPnl / row.totalRisk : null
              const isW = row.totalPnl > 0, isL = row.totalPnl < 0
              const isExpanded = expandedGroups.has(row.key)
              const isActive = !row.isGroup && selected?.id === row.legs[0].id

              const mainRow = (
                <tr
                  key={row.key}
                  style={{ cursor: 'pointer', background: isActive ? 'var(--ac-d2)' : undefined }}
                  onClick={() => row.isGroup ? toggleGroup(row.key) : setSelected(row.legs[0])}
                >
                  <td style={{ fontSize: '10px', color: 'var(--txt2)', fontFamily: 'var(--mono)' }}>{fmtDate(row.date)}</td>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {row.isGroup && (
                        <span style={{ fontSize: '9px', color: 'var(--txt3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '.1s', display: 'inline-block' }}>▶</span>
                      )}
                      {row.symbol}
                      {row.isGroup && (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '1px 6px' }}>
                          {row.legs.length} exits
                        </span>
                      )}
                    </div>
                  </td>
                  <td><span style={isW ? badgeWin : isL ? badgeLoss : badgeBe}>{isW ? 'WIN' : isL ? 'LOSS' : 'BE'}</span></td>
                  <td style={{ fontSize: '11px' }}>{row.type}</td>
                  <td style={{ fontSize: '10px', color: 'var(--txt2)' }}>{row.setup || '—'}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{row.avgEntry ? `$${row.avgEntry.toFixed(2)}` : ''}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{row.lastExit ? `$${row.lastExit.toFixed(2)}` : '—'}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{row.totalShares || ''}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', color: isW ? 'var(--ac)' : isL ? 'var(--red)' : '', fontWeight: 600 }}>{fmtPnl(row.totalPnl)}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: roi >= 0 ? 'var(--ac)' : 'var(--red)' }}>{roi.toFixed(2)}%</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>{rm !== null ? `${rm.toFixed(2)}R` : '—'}</td>
                  <td style={{ fontSize: '11px' }}>{row.grade || '—'}</td>
                  <td>{row.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>)}</td>
                  <td>
                    <button className="btn-d" onClick={e => { e.stopPropagation(); handleDeleteGroup(row) }} style={{ padding: '3px 8px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              )

              if (!row.isGroup || !isExpanded) return mainRow

              const legRows = row.legs.map((t, i) => {
                const legActive = selected?.id === t.id
                return (
                  <tr key={t.id} style={{ cursor: 'pointer', background: legActive ? 'var(--ac-d2)' : 'var(--bg3)' }} onClick={() => setSelected(t)}>
                    <td />
                    <td style={{ fontSize: '10px', color: 'var(--txt3)', paddingLeft: '22px', fontFamily: 'var(--mono)' }}>
                      {fmtLegMoment(t.exit_date || t.date)} · {Math.round((t.shares / row.totalShares) * 100)}% closed
                    </td>
                    <td />
                    <td />
                    <td />
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt3)' }}>${t.entry.toFixed(2)}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>{t.exit ? `$${t.exit.toFixed(2)}` : '—'}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>{t.shares}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 600, color: t.pnl > 0 ? 'var(--ac)' : t.pnl < 0 ? 'var(--red)' : '' }}>{fmtPnl(t.pnl)}</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                )
              })

              return [mainRow, ...legRows]
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list — same data as the table, reflowed to one column.
          Hidden on desktop; CSS in globals.css swaps these at 768px. */}
      <div className="mobile-trade-cards">
        {filtered.length === 0 ? (
          <div className="empty">No trades found. Add your first trade using the "+ Add Trade" button.</div>
        ) : groupedFiltered.map(row => {
          const roi = row.avgEntry && row.totalShares ? (row.totalPnl / (row.avgEntry * row.totalShares)) * 100 : 0
          const rm  = row.totalRisk > 0 ? row.totalPnl / row.totalRisk : null
          const isW = row.totalPnl > 0, isL = row.totalPnl < 0
          return (
            <div
              key={row.key}
              onClick={() => setSelected(row.legs[row.legs.length - 1])}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)',
                padding: '12px 14px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '14px' }}>{row.symbol}</span>
                    <span style={isW ? badgeWin : isL ? badgeLoss : badgeBe}>{isW ? 'WIN' : isL ? 'LOSS' : 'BE'}</span>
                    {row.isGroup && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg4)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '1px 6px' }}>
                        {row.legs.length} exits
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--txt2)' }}><span style={{ fontFamily: 'var(--mono)' }}>{fmtDate(row.date)}</span> · {row.type}{row.setup ? ` · ${row.setup}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '14px', color: isW ? 'var(--ac)' : isL ? 'var(--red)' : 'var(--txt)' }}>{fmtPnl(row.totalPnl)}</div>
                  <div style={{ fontSize: '10px', color: roi >= 0 ? 'var(--ac)' : 'var(--red)' }}>{roi.toFixed(2)}%</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--txt2)', fontFamily: 'var(--mono)' }}>
                <span>Entry {row.avgEntry ? `$${row.avgEntry.toFixed(2)}` : '—'}</span>
                <span>Exit {row.lastExit ? `$${row.lastExit.toFixed(2)}` : '—'}</span>
                <span>{row.totalShares || 0} {assetUnitLabel(row.legs[0]?.asset_type).toLowerCase()}</span>
                <span>{rm !== null ? `${rm.toFixed(2)}R` : '—'}</span>
              </div>
            </div>
          )
        })}
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
