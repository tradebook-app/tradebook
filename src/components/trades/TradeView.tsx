'use client'

import { useState, useMemo } from 'react'
import type { TradeRow, DateRangeFilter } from '@/lib/types'
import { assetUnitLabel } from '@/lib/types'
import { filterByDate, closedTrades, calcKPIs, fmtPnl, fmtDate, tradeRoi, fmtProfitFactor } from '@/lib/analytics'
import { filterByStatus, type TradeStatusFilter } from '@/lib/tradeTableFilters'
import { MetricCard } from '@/components/ui/MetricCard'
import { TradePanel } from '@/components/trades/TradePanel'
import { DateRangePicker } from '@/components/layout/DateRangePicker'
import { FilterDropdown } from '@/components/ui/FilterDropdown'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/lib/usePagination'

type Props = {
  trades: TradeRow[]
  filter: DateRangeFilter
  onFilterChange: (f: DateRangeFilter) => void
  onEdit: (trade: TradeRow) => void
  onDelete: (id: string) => void
  onDeleteFiltered: (ids: string[]) => void
  onRemoveScreenshot: (tradeId: string, path: string) => Promise<void>
}

type GroupedRow = {
  key: string
  legs: TradeRow[]
  isGroup: boolean
  symbol: string
  type: 'Long' | 'Short'
  asset_type: TradeRow['asset_type']
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
      asset_type: legs[0].asset_type,
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
      asset_type: t.asset_type,
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

export function TradeView({ trades, filter, onFilterChange, onEdit, onDelete, onDeleteFiltered, onRemoveScreenshot }: Props) {
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
    // Trade View is the full trade log — closed AND open positions. Open
    // trades (no exit yet) render with Exit / Net P&L / ROI / R blanked to
    // "—". The KPI row below still uses closedTrades() so headline stats are
    // unaffected, and Dashboard's "Open positions" logic is untouched.
    let r = filterByDate(trades, filter)
    if (symFilter)            r = r.filter(t => t.symbol.includes(symFilter.toUpperCase()))
    r = filterByStatus(r, stFilter as TradeStatusFilter)
    if (sideFilter !== 'all') r = r.filter(t => t.type === sideFilter)
    if (setupFilter !== 'all') r = r.filter(t => t.setup === setupFilter)
    // trades already arrives newest-first from fetchTrades(), and the table
    // (via buildGroupedRows) sorts newest-first too — this must match that
    // order exactly, or the Trade Preview panel's up/down keyboard nav ends
    // up walking the list backwards relative to what's on screen.
    return r.slice()
  }, [trades, filter, symFilter, stFilter, sideFilter, setupFilter])

  const kpi = useMemo(() => calcKPIs(filterByDate(closedTrades(trades), filter)), [trades, filter])

  const groupedFiltered = useMemo(() => buildGroupedRows(filtered), [filtered])

  const pg = usePagination(groupedFiltered.length, 'sleek-tradeview-pagesize')
  const pageRows = useMemo(() => groupedFiltered.slice(pg.start, pg.end), [groupedFiltered, pg.start, pg.end])
  // flat trade list for just the visible page — keeps the preview panel's
  // up/down keyboard nav within what's on screen.
  const pageTrades = useMemo(() => pageRows.flatMap(r => r.legs), [pageRows])

  function handleDeleteFiltered() {
    // Always delete exactly the trades currently on screen under the applied
    // filters — never anything outside that set. The old "isAll" check
    // compared filtered.length to the ACCOUNT-WIDE closed-trade count (not
    // filtered.length to trades.length), so a coincidental count match — e.g.
    // filtering to one symbol that happens to have as many trades as the
    // account has closed trades overall, or filtering to something with zero
    // matches while the account happens to have zero closed trades — would
    // silently switch `ids` to trades.map(...), deleting every trade in the
    // account instead of the filtered subset, with a confirmation message
    // that still described it as "filtered".
    if (!filtered.length) return alert('No trades match current filters.')
    const ids = filtered.map(t => t.id)
    const isAll = filtered.length === trades.length  // every trade in the account matches the current filter
    const openCount = filtered.filter(t => !(t.exit && t.exit > 0)).length
    const openNote = openCount ? ` (including ${openCount} open position${openCount > 1 ? 's' : ''})` : ''
    const msg = isAll
      ? `⚠️ Delete ALL ${ids.length} trades${openNote}? This cannot be undone.`
      : `Delete ${ids.length} filtered trade${ids.length > 1 ? 's' : ''}${openNote}? This cannot be undone.`
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
  const badgeOpen: React.CSSProperties = { ...badgeBase, background: 'rgba(59,130,246,.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,.35)', textShadow: '0 0 8px rgba(59,130,246,.35)' }

  return (
    <>
      <div className="page-shell">
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
                { label: `${kpi.breakeven}BE`, bg: 'var(--bg5)', color: 'var(--txt3)' },
                { label: `${kpi.losses}L`, bg: 'var(--red-d)', color: 'var(--red)' },
              ].map((b, i) => (
                <span key={i} style={{ fontSize: '10px', fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: '10px', background: b.bg, color: b.color }}>{b.label}</span>
              ))}
            </div>
          }
          gauge={{ pct: kpi.winRate, color: kpi.winRate >= 40 ? 'var(--ac)' : 'var(--red)' }}
        />
        <MetricCard label="Profit Factor" value={fmtProfitFactor(kpi.profitFactor)} gauge={{ pct: Math.min(kpi.profitFactor / 3 * 100, 100), color: kpi.profitFactor >= 1.5 ? 'var(--ac)' : 'var(--red)' }} />
        <MetricCard
          label="Avg Win / Loss"
          value={kpi.avgWinLossRatio.toFixed(2)}
          sub={
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: '10px', background: 'var(--ac-d)', color: 'var(--ac)' }}>{fmtPnl(kpi.avgWin)}</span>
              <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: '10px', background: 'var(--red-d)', color: 'var(--red)' }}>-${kpi.avgLoss.toFixed(0)}</span>
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
            { value: 'open', label: 'Open' },
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

      {/* Data list — the only thing that scrolls; KPIs + filters stay pinned.
          Sticky <thead> pins to the top of .page-scroll as rows scroll. */}
      <div className="page-scroll">
      {/* Table — desktop/tablet only, see .mobile-trade-cards below for phone */}
      <div className="desktop-table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Symbol</th><th>Status</th><th>Side</th>
              <th className="r">Entry</th><th className="r">Exit</th><th className="r">Size</th>
              <th className="r">Net P&L</th><th className="r">ROI</th><th className="r">R</th>
              <th>Grade</th><th>Setup</th><th>Tags</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={14} className="empty">No trades found. Add your first trade using the "+ Add Trade" button.</td></tr>
            ) : pageRows.map(row => {
              // Same cost-basis math as P&L (options ×100, futures ×point value,
              // forex ×lot size) — previously divided by raw entry×shares,
              // inflating options ROI by ~100x. null when the multiplier can't
              // be determined.
              const roi = tradeRoi({ entry: row.avgEntry, shares: row.totalShares, pnl: row.totalPnl, asset_type: row.asset_type, symbol: row.symbol })
              const rm  = row.totalRisk > 0 ? row.totalPnl / row.totalRisk : null
              const isOpen = !(row.lastExit && row.lastExit > 0)
              const isW = !isOpen && row.totalPnl > 0, isL = !isOpen && row.totalPnl < 0
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
                  <td><span style={isOpen ? badgeOpen : isW ? badgeWin : isL ? badgeLoss : badgeBe}>{isOpen ? 'OPEN' : isW ? 'WIN' : isL ? 'LOSS' : 'BE'}</span></td>
                  <td style={{ fontSize: '11px' }}>{row.type}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{row.avgEntry ? `$${row.avgEntry.toFixed(2)}` : ''}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{row.lastExit ? `$${row.lastExit.toFixed(2)}` : '—'}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{row.totalShares || ''}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', color: isW ? 'var(--ac)' : isL ? 'var(--red)' : '', fontWeight: 600 }}>{isOpen ? '—' : fmtPnl(row.totalPnl)}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: roi == null ? 'var(--txt3)' : roi >= 0 ? 'var(--ac)' : 'var(--red)' }}>{isOpen || roi == null ? '—' : `${roi.toFixed(2)}%`}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>{isOpen || rm === null ? '—' : `${rm.toFixed(2)}R`}</td>
                  <td style={{ fontSize: '11px' }}>{row.grade || '—'}</td>
                  <td style={{ fontSize: '10px', color: 'var(--txt2)' }}>{row.setup || '—'}</td>
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
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt3)' }}>${t.entry.toFixed(2)}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>{t.exit ? `$${t.exit.toFixed(2)}` : '—'}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>{t.shares}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 600, color: t.pnl > 0 ? 'var(--ac)' : t.pnl < 0 ? 'var(--red)' : '' }}>{fmtPnl(t.pnl)}</td>
                    <td />
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
        ) : pageRows.map(row => {
          const roi = tradeRoi({ entry: row.avgEntry, shares: row.totalShares, pnl: row.totalPnl, asset_type: row.asset_type, symbol: row.symbol })
          const rm  = row.totalRisk > 0 ? row.totalPnl / row.totalRisk : null
          const isOpen = !(row.lastExit && row.lastExit > 0)
          const isW = !isOpen && row.totalPnl > 0, isL = !isOpen && row.totalPnl < 0
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
                    <span style={isOpen ? badgeOpen : isW ? badgeWin : isL ? badgeLoss : badgeBe}>{isOpen ? 'OPEN' : isW ? 'WIN' : isL ? 'LOSS' : 'BE'}</span>
                    {row.isGroup && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg4)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '1px 6px' }}>
                        {row.legs.length} exits
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--txt2)' }}><span style={{ fontFamily: 'var(--mono)' }}>{fmtDate(row.date)}</span> · {row.type}{row.setup ? ` · ${row.setup}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '14px', color: isW ? 'var(--ac)' : isL ? 'var(--red)' : 'var(--txt)' }}>{isOpen ? '—' : fmtPnl(row.totalPnl)}</div>
                  <div style={{ fontSize: '10px', color: roi == null ? 'var(--txt3)' : roi >= 0 ? 'var(--ac)' : 'var(--red)' }}>{isOpen ? '' : roi == null ? '—' : `${roi.toFixed(2)}%`}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--txt2)', fontFamily: 'var(--mono)' }}>
                <span>Entry {row.avgEntry ? `$${row.avgEntry.toFixed(2)}` : '—'}</span>
                <span>Exit {row.lastExit ? `$${row.lastExit.toFixed(2)}` : '—'}</span>
                <span>{row.totalShares || 0} {assetUnitLabel(row.legs[0]?.asset_type).toLowerCase()}</span>
                <span>{isOpen || rm === null ? '—' : `${rm.toFixed(2)}R`}</span>
              </div>
            </div>
          )
        })}
      </div>
      </div>
      {groupedFiltered.length > 0 && <Pagination pg={pg} itemLabel="trades" />}
      </div>

      <TradePanel
        trade={selected}
        trades={pageTrades}
        onClose={() => setSelected(null)}
        onEdit={t => { setSelected(null); onEdit(t) }}
        onDelete={id => { onDelete(id); setSelected(null) }}
        onNavigate={t => setSelected(t)}
        onRemoveScreenshot={async (id, path) => {
          await onRemoveScreenshot(id, path)
          setSelected(prev => {
            if (!prev || prev.id !== id) return prev
            const urls = (prev.screenshot_urls || []).filter(p => p !== path)
            return { ...prev, screenshot_urls: urls, screenshot_url: urls[0] ?? null }
          })
        }}
      />
    </>
  )
}