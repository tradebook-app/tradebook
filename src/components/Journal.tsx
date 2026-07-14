'use client'

import { useState, useMemo, useEffect } from 'react'
import type { TradeRow } from '@/lib/types'
import TradeChart, { Candle, TradeMarker } from '@/components/charts/TradeChart'

type Props = {
  trades: TradeRow[]
  onEdit: (trade: TradeRow) => void
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function parseDate(s: string) {
  return s.slice(0, 10)
}

function weekStart(d: Date) {
  const day = new Date(d)
  const dow = day.getDay()
  day.setDate(day.getDate() - dow)
  return formatDate(day)
}

function weekEnd(d: Date) {
  const day = new Date(d)
  const dow = day.getDay()
  day.setDate(day.getDate() + (6 - dow))
  return formatDate(day)
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function calcStats(trades: TradeRow[]) {
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0
  return { netPnl, winRate, profitFactor, wins: wins.length, losses: losses.length, total: trades.length, grossWin, grossLoss }
}

function MiniChart({ trades }: { trades: TradeRow[] }) {
  if (trades.length === 0) return null
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  let cum = 0
  const points = [0, ...sorted.map(t => { cum += t.pnl; return cum })]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const W = 300, H = 80
  const xs = points.map((_, i) => (i / (points.length - 1)) * W)
  const ys = points.map(p => H - ((p - min) / range) * (H - 8) - 4)
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const fill = path + ` L${W},${H} L0,${H} Z`
  const isPositive = cum >= 0
  const color = isPositive ? '#10B981' : '#EF4444'
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="jg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#jg)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type DetailTab = 'chart' | 'details'
type ChartTimeframe = '15min' | '1h' | '1day'

// Combines trades that share a trade_group_id (partial exits from the same
// position) into one row for display. Trades with no group id, or that are
// the only leg in their group, render exactly as a normal single trade.
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
  lastExitDate: string | null
  totalPnl: number
  grade: string | null
  setup: string | null
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
      lastExitDate: lastLeg?.exit_date ?? null,
      totalPnl: legs.reduce((s, l) => s + l.pnl, 0),
      grade: lastLeg?.grade ?? null,
      setup: lastLeg?.setup ?? null,
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
      lastExitDate: t.exit_date,
      totalPnl: t.pnl,
      grade: t.grade,
      setup: t.setup,
    })
  }

  return rows
}

function TradeDetailPanel({ trade, trades, onClose, onEdit, onNavigate }: { trade: TradeRow, trades: TradeRow[], onClose: () => void, onEdit: (t: TradeRow) => void, onNavigate: (t: TradeRow) => void }) {
  const pnlColor = trade.pnl > 0 ? 'var(--ac)' : trade.pnl < 0 ? 'var(--red)' : 'var(--txt3)'
  const currentIndex = trades.findIndex(t => t.id === trade.id)

  const [detailTab, setDetailTab] = useState<DetailTab>('details')
  const [candles, setCandles] = useState<Candle[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)
  const [chartInterval, setChartInterval] = useState<string>('15min')
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('15min')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') { e.preventDefault(); if (currentIndex > 0) onNavigate(trades[currentIndex - 1]) }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (currentIndex < trades.length - 1) onNavigate(trades[currentIndex + 1]) }
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [currentIndex, trades, onNavigate, onClose])

  // Reset chart state when the selected trade changes
  useEffect(() => {
    setDetailTab('details')
    setCandles([])
    setChartError(null)
    setSelectedTimeframe('15min')
  }, [trade.id])

  // Fetch candle data when Chart tab is opened or timeframe changes
  useEffect(() => {
    if (detailTab !== 'chart') return

    setChartLoading(true)
    setChartError(null)
    setCandles([])

    const tradeDate = new Date(trade.date)
    const paddedStart = new Date(tradeDate)
    paddedStart.setDate(paddedStart.getDate() - 10)
    const startDate = paddedStart.toISOString().slice(0, 10)
    const endDate = new Date().toISOString().slice(0, 10)

    const params = new URLSearchParams({ symbol: trade.symbol, interval: selectedTimeframe })
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)

    fetch(`/api/candles?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setChartError(data.error)
        } else {
          setCandles(data.candles || [])
          setChartInterval(data.interval || selectedTimeframe)
        }
      })
      .catch(() => setChartError('Failed to load chart data'))
      .finally(() => setChartLoading(false))
  }, [detailTab, trade, selectedTimeframe])

  const markers: TradeMarker[] = useMemo(() => {
    const isIntraday = chartInterval !== '1day'
    const formatTime = (d: string): string | number => {
      if (isIntraday) {
        const iso = d.slice(0, 10) + 'T' + (d.slice(11) || '00:00:00') + 'Z'
        return Math.floor(new Date(iso).getTime() / 1000)
      }
      return d.slice(0, 10)
    }
    const result: TradeMarker[] = []
    if (trade.date) {
      result.push({
        time: formatTime(trade.date),
        position: trade.type === 'Short' ? 'aboveBar' : 'belowBar',
        color: '#3b82f6',
        shape: trade.type === 'Short' ? 'arrowDown' : 'arrowUp',
        text: `Entry $${trade.entry}`,
      })
    }
    if (trade.exit) {
      const isWin = trade.pnl > 0
      result.push({
        time: formatTime(trade.exit_date || trade.date),
        position: trade.type === 'Short' ? 'belowBar' : 'aboveBar',
        color: isWin ? '#22c55e' : '#ef4444',
        shape: trade.type === 'Short' ? 'arrowUp' : 'arrowDown',
        text: `Exit $${trade.exit}`,
      })
    }
    return result
  }, [trade, chartInterval])

  const TIMEFRAMES: { key: ChartTimeframe; label: string }[] = [
    { key: '15min', label: '15m' },
    { key: '1h',    label: '1H' },
    { key: '1day',  label: '1D' },
  ]

  const rows = [
    { l: 'Symbol', v: trade.symbol },
    { l: 'Side', v: trade.type },
    { l: 'Entry', v: '$' + trade.entry.toFixed(2) },
    { l: 'Exit', v: trade.exit ? '$' + trade.exit.toFixed(2) : '—' },
    { l: 'Shares', v: trade.shares.toString() },
    { l: 'Commission', v: '$' + trade.commission.toFixed(2) },
    { l: 'Risk 1R', v: trade.risk ? '$' + trade.risk.toFixed(2) : '—' },
    { l: 'Setup', v: trade.setup || '—' },
    { l: 'Grade', v: trade.grade || '—' },
    { l: 'Tags', v: trade.tags?.join(', ') || '—' },
  ]

  return (
    <div style={{ width: '420px', flexShrink: 0, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--txt)' }}>{trade.symbol}</div>
          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '1px' }}>
            {new Date(trade.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => currentIndex > 0 && onNavigate(trades[currentIndex - 1])} disabled={currentIndex <= 0} title="Previous (↑)" style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '5px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer', opacity: currentIndex <= 0 ? 0.3 : 1, color: 'var(--txt2)', fontSize: '11px' }}>↑</button>
          <button onClick={() => currentIndex < trades.length - 1 && onNavigate(trades[currentIndex + 1])} disabled={currentIndex >= trades.length - 1} title="Next (↓)" style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '5px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentIndex >= trades.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIndex >= trades.length - 1 ? 0.3 : 1, color: 'var(--txt2)', fontSize: '11px' }}>↓</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 4px' }}>×</button>
        </div>
      </div>

      {/* P&L */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--brd)', textAlign: 'center' }}>
        <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Net P&L</div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: pnlColor, fontFamily: 'var(--mono)' }}>
          {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '10px', padding: '2px 10px', borderRadius: '20px', background: trade.type === 'Long' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: trade.type === 'Long' ? 'var(--ac)' : 'var(--red)', fontWeight: 600 }}>{trade.type}</span>
          {trade.pnl > 0 && <span style={{ fontSize: '10px', padding: '2px 10px', borderRadius: '20px', background: 'rgba(16,185,129,.1)', color: 'var(--ac)', fontWeight: 600 }}>Win</span>}
          {trade.pnl < 0 && <span style={{ fontSize: '10px', padding: '2px 10px', borderRadius: '20px', background: 'rgba(239,68,68,.1)', color: 'var(--red)', fontWeight: 600 }}>Loss</span>}
          {trade.grade && <span style={{ fontSize: '10px', padding: '2px 10px', borderRadius: '20px', background: 'var(--bg3)', color: 'var(--txt2)', fontWeight: 600 }}>{trade.grade}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--brd)', padding: '0 16px' }}>
        {(['chart', 'details'] as const).map(k => (
          <button key={k} onClick={() => setDetailTab(k)} style={{ padding: '9px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${detailTab === k ? 'var(--ac)' : 'transparent'}`, color: detailTab === k ? 'var(--ac2)' : 'var(--txt3)', fontFamily: 'var(--sans)', textTransform: 'capitalize' }}>{k}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {detailTab === 'chart' && (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {TIMEFRAMES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedTimeframe(key)}
                  style={{
                    padding: '4px 10px', fontSize: '10px', fontWeight: 700, borderRadius: '5px', cursor: 'pointer',
                    border: `1px solid ${selectedTimeframe === key ? 'var(--ac)' : 'var(--brd)'}`,
                    background: selectedTimeframe === key ? 'var(--ac-d)' : 'var(--bg3)',
                    color: selectedTimeframe === key ? 'var(--ac)' : 'var(--txt2)',
                    fontFamily: 'var(--mono)',
                  }}
                >{label}</button>
              ))}
            </div>
            {chartLoading ? (
              <div style={{ color: 'var(--txt3)', fontSize: '11px', padding: '20px 0', textAlign: 'center' }}>Loading chart…</div>
            ) : chartError ? (
              <div style={{ color: 'var(--red)', fontSize: '11px', padding: '20px 0', textAlign: 'center' }}>{chartError}</div>
            ) : candles.length === 0 ? (
              <div style={{ color: 'var(--txt3)', fontSize: '11px', padding: '20px 0', textAlign: 'center' }}>No chart data available.</div>
            ) : (
              <TradeChart candles={candles} markers={markers} height={460} />
            )}
          </div>
        )}

        {detailTab === 'details' && (
          <>
            {rows.map(r => (
              <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--brd2)' }}>
                <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>{r.l}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--txt)', fontFamily: ['Entry','Exit','Commission','Risk 1R'].includes(r.l) ? 'var(--mono)' : 'var(--sans)' }}>{r.v}</span>
              </div>
            ))}
            {trade.notes && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--brd2)' }}>
                <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Notes</div>
                <div style={{ fontSize: '11px', color: 'var(--txt2)', lineHeight: 1.6 }}>{trade.notes}</div>
              </div>
            )}
            {trade.screenshot_url && (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px' }}>Screenshot</div>
                <img src={trade.screenshot_url} alt="Trade screenshot" style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--brd)' }} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit button */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--brd)' }}>
        <button
          onClick={() => onEdit(trade)}
          style={{ width: '100%', padding: '8px', background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: 'var(--r)', color: 'var(--txt2)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', transition: '.1s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ac)'; e.currentTarget.style.color = 'var(--ac)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd2)'; e.currentTarget.style.color = 'var(--txt2)' }}
        >
          Edit trade
        </button>
      </div>
    </div>
  )
}

export function Journal({ trades, onEdit }: Props) {
  const today = formatDate(new Date())
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState(today)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selectedTrade, setSelectedTrade] = useState<TradeRow | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const byDate = useMemo(() => {
    const map: Record<string, TradeRow[]> = {}
    for (const t of trades) {
      const d = parseDate(t.date)
      if (!map[d]) map[d] = []
      map[d].push(t)
    }
    return map
  }, [trades])

  const dayTrades = useMemo(() => byDate[selectedDate] || [], [byDate, selectedDate])
  const dayStats = useMemo(() => calcStats(dayTrades), [dayTrades])

  const wStart = weekStart(new Date(selectedDate))
  const wEnd = weekEnd(new Date(selectedDate))

  const weekDays = useMemo(() => {
    const days = []
    const start = new Date(wStart)
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      days.push(formatDate(d))
    }
    return days
  }, [wStart])

  const weekTrades = useMemo(() => weekDays.flatMap(d => byDate[d] || []), [weekDays, byDate])
  const weekStats = useMemo(() => calcStats(weekTrades), [weekTrades])

  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const d = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(d)
    setSelectedTrade(null)
  }

  function handleTradeClick(t: TradeRow) {
    setSelectedTrade(prev => prev?.id === t.id ? null : t)
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const statStyle = { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '12px 14px' }

  const tradeTable = (tradesToShow: TradeRow[], showDay = false) => {
    const rows = buildGroupedRows(tradesToShow).sort((a, b) => a.date.localeCompare(b.date))

    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <table className="tbl" style={{ width: '100%' }}>
          <thead>
            <tr>
              {showDay && <th>Day</th>}
              <th>Time</th>
              <th>Symbol</th>
              <th>Status</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Shares</th>
              <th className="r">P&L</th>
              <th>Grade</th>
              <th>Setup</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isExpanded = expandedGroups.has(row.key)
              const groupRow = (
                <tr
                  key={row.key}
                  onClick={() => row.isGroup ? toggleGroup(row.key) : handleTradeClick(row.legs[0])}
                  style={{
                    cursor: 'pointer',
                    background: !row.isGroup && selectedTrade?.id === row.legs[0].id ? 'var(--ac-d)' : undefined,
                  }}
                >
                  {showDay && <td style={{ color: 'var(--txt3)' }}>{new Date(row.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>}
                  <td style={{ color: 'var(--txt3)' }}>{new Date(row.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {row.isGroup && (
                      <span style={{ fontSize: '9px', color: 'var(--txt3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '.1s', display: 'inline-block' }}>▶</span>
                    )}
                    {row.symbol}
                    {row.isGroup && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '1px 6px' }}>
                        {row.legs.length} exits
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: row.totalPnl > 0 ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                      color: row.totalPnl > 0 ? 'var(--ac)' : 'var(--red)',
                    }}>
                      {row.totalPnl > 0 ? 'Win' : 'Loss'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)' }}>${row.avgEntry.toFixed(2)}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{row.lastExit ? '$' + row.lastExit.toFixed(2) : '—'}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{row.totalShares}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: row.totalPnl > 0 ? 'var(--ac)' : row.totalPnl < 0 ? 'var(--red)' : 'var(--txt3)' }}>
                    {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toFixed(2)}
                  </td>
                  <td>{row.grade ? <span style={{ fontSize: '11px', fontWeight: 700, color: row.grade === 'A' || row.grade === 'A+' ? 'var(--ac)' : row.grade === 'B' ? 'var(--blue)' : row.grade === 'C' ? 'var(--orange)' : 'var(--red)' }}>{row.grade}</span> : '—'}</td>
                  <td style={{ color: 'var(--txt2)', fontSize: '11px' }}>{row.setup || '—'}</td>
                </tr>
              )

              if (!row.isGroup || !isExpanded) return groupRow

              const legRows = row.legs.map((t, i) => {
                const isActive = selectedTrade?.id === t.id
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleTradeClick(t)}
                    style={{ cursor: 'pointer', background: isActive ? 'var(--ac-d)' : 'var(--bg3)' }}
                  >
                    {showDay && <td />}
                    <td style={{ color: 'var(--txt3)', fontSize: '11px' }}>{new Date(t.exit_date || t.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ color: 'var(--txt3)', fontSize: '11px', paddingLeft: '22px' }}>exit {i + 1}</td>
                    <td />
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt3)' }}>${t.entry.toFixed(2)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{t.exit ? '$' + t.exit.toFixed(2) : '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{t.shares}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: t.pnl > 0 ? 'var(--ac)' : t.pnl < 0 ? 'var(--red)' : 'var(--txt3)' }}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                    </td>
                    <td />
                    <td />
                  </tr>
                )
              })

              return [groupRow, ...legRows]
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '16px', padding: '20px', height: '100%' }}>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700 }}>Journal</h1>
          <div style={{ display: 'flex', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '3px', gap: '2px' }}>
            {(['day', 'week'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setSelectedTrade(null) }} style={{
                padding: '5px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, fontFamily: 'var(--sans)',
                background: mode === m ? 'var(--ac)' : 'transparent',
                color: mode === m ? '#000' : 'var(--txt2)', transition: '.15s',
              }}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
            ))}
          </div>
        </div>

        {/* DAY VIEW */}
        {mode === 'day' && (
          <>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: dayTrades.length > 0 ? '14px' : '0' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '2px' }}>
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  {dayTrades.length > 0 && (
                    <div style={{ fontSize: '13px' }}>
                      Net P&L: <span style={{ color: dayStats.netPnl >= 0 ? 'var(--ac)' : 'var(--red)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{dayStats.netPnl >= 0 ? '+' : ''}{dayStats.netPnl.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(formatDate(d)); setSelectedTrade(null) }} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '5px 12px', color: 'var(--txt2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>← Prev</button>
                  <button onClick={() => { setSelectedDate(today); setSelectedTrade(null) }} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '5px 12px', color: 'var(--txt2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>Today</button>
                  <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(formatDate(d)); setSelectedTrade(null) }} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '5px 12px', color: 'var(--txt2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>Next →</button>
                </div>
              </div>
              {dayTrades.length > 0 && (
                <>
                  <div style={{ marginBottom: '12px' }}><MiniChart trades={dayTrades} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                    {[
                      { l: 'Total Trades', v: dayStats.total },
                      { l: 'Win Rate', v: dayStats.winRate.toFixed(1) + '%' },
                      { l: 'Winners', v: dayStats.wins },
                      { l: 'Losers', v: dayStats.losses },
                      { l: 'Gross P&L', v: '$' + dayStats.netPnl.toFixed(2), pnl: dayStats.netPnl },
                      { l: 'Profit Factor', v: dayStats.profitFactor === Infinity ? '∞' : dayStats.profitFactor.toFixed(2) },
                    ].map(s => (
                      <div key={s.l} style={statStyle}>
                        <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{s.l}</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: s.pnl !== undefined ? (s.pnl >= 0 ? 'var(--ac)' : 'var(--red)') : 'var(--txt)', fontFamily: 'var(--mono)' }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {dayTrades.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: '12px' }}>No trades on this day</div>}
            </div>
            {dayTrades.length > 0 && tradeTable(dayTrades)}
          </>
        )}

        {/* WEEK VIEW */}
        {mode === 'week' && (
          <>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '2px' }}>
                    {new Date(wStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(wEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  {weekTrades.length > 0 && (
                    <div style={{ fontSize: '13px' }}>Net P&L: <span style={{ color: weekStats.netPnl >= 0 ? 'var(--ac)' : 'var(--red)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{weekStats.netPnl >= 0 ? '+' : ''}{weekStats.netPnl.toFixed(2)}</span></div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(formatDate(d)); setSelectedTrade(null) }} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '5px 12px', color: 'var(--txt2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>← Prev</button>
                  <button onClick={() => { setSelectedDate(today); setSelectedTrade(null) }} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '5px 12px', color: 'var(--txt2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>This Week</button>
                  <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(formatDate(d)); setSelectedTrade(null) }} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '5px 12px', color: 'var(--txt2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>Next →</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '14px' }}>
                {weekDays.map(d => {
                  const dt = byDate[d] || []
                  const pnl = dt.reduce((s, t) => s + t.pnl, 0)
                  const isSelected = d === selectedDate
                  const isToday = d === today
                  const hasTrades = dt.length > 0
                  return (
                    <div key={d} onClick={() => { setSelectedDate(d); setMode('day'); setSelectedTrade(null) }} style={{ background: hasTrades ? (pnl >= 0 ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)') : 'var(--bg3)', border: `1px solid ${isSelected ? 'var(--ac)' : isToday ? 'var(--brd2)' : 'var(--brd)'}`, borderRadius: 'var(--r)', padding: '10px 8px', textAlign: 'center', cursor: 'pointer', transition: '.15s' }}>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div style={{ fontSize: '11px', color: 'var(--txt2)', marginBottom: '4px' }}>{new Date(d + 'T12:00:00').getDate()}</div>
                      {hasTrades ? (
                        <>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: pnl >= 0 ? 'var(--ac)' : 'var(--red)', fontFamily: 'var(--mono)' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}</div>
                          <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>{dt.length}t</div>
                        </>
                      ) : <div style={{ fontSize: '9px', color: 'var(--txt4)' }}>—</div>}
                    </div>
                  )
                })}
              </div>

              {weekTrades.length > 0 && <div style={{ marginBottom: '12px' }}><MiniChart trades={weekTrades} /></div>}

              {weekTrades.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {[
                    { l: 'Total Trades', v: weekStats.total },
                    { l: 'Win Rate', v: weekStats.winRate.toFixed(1) + '%' },
                    { l: 'Winners', v: weekStats.wins },
                    { l: 'Losers', v: weekStats.losses },
                    { l: 'Net P&L', v: '$' + weekStats.netPnl.toFixed(2), pnl: weekStats.netPnl },
                    { l: 'Profit Factor', v: weekStats.profitFactor === Infinity ? '∞' : weekStats.profitFactor.toFixed(2) },
                  ].map(s => (
                    <div key={s.l} style={statStyle}>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{s.l}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: s.pnl !== undefined ? (s.pnl >= 0 ? 'var(--ac)' : 'var(--red)') : 'var(--txt)', fontFamily: 'var(--mono)' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              )}
              {weekTrades.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: '12px' }}>No trades this week</div>}
            </div>
            {weekTrades.length > 0 && tradeTable(weekTrades, true)}
          </>
        )}
      </div>

      {/* Right panel: calendar always on top, trade detail below */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Calendar — always visible */}
        <div style={{ width: '220px', flexShrink: 0 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>‹</button>
              <div style={{ fontSize: '12px', fontWeight: 700 }}>{MONTHS[calMonth]} {calYear}</div>
              <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
              {DAYS_SHORT.map(d => <div key={d} style={{ fontSize: '8px', color: 'var(--txt4)', textAlign: 'center', fontWeight: 600 }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const d = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dt = byDate[d] || []
                const pnl = dt.reduce((s, t) => s + t.pnl, 0)
                const isSelected = d === selectedDate
                const isToday = d === today
                const hasTrades = dt.length > 0
                return (
                  <div key={day} onClick={() => selectDay(day)} style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: isSelected || isToday ? 700 : 400, borderRadius: '5px', cursor: 'pointer', transition: '.1s', background: isSelected ? 'var(--ac)' : hasTrades ? (pnl >= 0 ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)') : 'transparent', color: isSelected ? '#000' : hasTrades ? (pnl >= 0 ? 'var(--ac)' : 'var(--red)') : isToday ? 'var(--txt)' : 'var(--txt2)', border: isToday && !isSelected ? '1px solid var(--brd2)' : '1px solid transparent' }}>
                    {day}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--txt3)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(16,185,129,.3)' }} /> Win day</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--txt3)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(239,68,68,.3)' }} /> Loss day</div>
            </div>
          </div>
        </div>

        {selectedTrade && (
          <TradeDetailPanel trade={selectedTrade} trades={mode === 'day' ? dayTrades : weekTrades} onClose={() => setSelectedTrade(null)} onEdit={onEdit} onNavigate={t => setSelectedTrade(t)} />
        )}
      </div>
    </div>
  )
}
