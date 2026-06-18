'use client'

import { useState, useMemo } from 'react'
import type { TradeRow, DateRangeFilter } from '@/lib/types'
import {
  filterByDate, closedTrades, openTrades,
  calcKPIs, calcDailyPnl, calcCumulative, calcDrawdown,
} from '@/lib/analytics'
import { DashboardKPIs } from './DashboardKPIs'
import { CumulativeChart } from './CumulativeChart'
import { DailyPnlChart } from './DailyPnlChart'
import { DrawdownChart } from './DrawdownChart'
import { MonthCalendar } from './MonthCalendar'
import { RecentTrades } from './RecentTrades'
import { OpenPositions } from './OpenPositions'
import { BackupRestore } from './BackupRestore'
import { TradePanel } from '@/components/trades/TradePanel'

type Props = {
  trades: TradeRow[]
  filter: DateRangeFilter
  onEdit: (t: TradeRow) => void
  onDelete: (id: string) => void
  userId: string
  onReload: () => void
}

type BottomTab = 'recent' | 'open'

export function Dashboard({ trades, filter, onEdit, onDelete, userId, onReload }: Props) {
  const [bottomTab, setBottomTab] = useState<BottomTab>('recent')
  const [selected,  setSelected]  = useState<TradeRow | null>(null)

  const filtered   = useMemo(() => filterByDate(trades, filter), [trades, filter])
  const closed     = useMemo(() => closedTrades(filtered), [filtered])
  const open       = useMemo(() => openTrades(trades), [trades])

  const kpi        = useMemo(() => calcKPIs(filtered), [filtered])
  const dailyPnl   = useMemo(() => calcDailyPnl(filtered), [filtered])
  const cumulative = useMemo(() => calcCumulative(filtered), [filtered])
  const drawdown   = useMemo(() => calcDrawdown(filtered), [filtered])
  const openPnl    = open.reduce((s, t) => s + (t.pnl || 0), 0)
  const maxDD      = drawdown.data.length ? Math.min(...drawdown.data) : 0

  const card: React.CSSProperties = {
    background: 'var(--bg3)', border: '1px solid var(--brd)',
    borderRadius: 'var(--r2)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  }
  const cardHead: React.CSSProperties = {
    padding: '11px 16px', borderBottom: '1px solid var(--brd)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: '11px', fontWeight: 700, color: 'var(--txt2)',
  }

  const chartCard = (title: string, node: React.ReactNode, extra?: React.ReactNode) => (
    <div style={card}>
      <div style={cardHead}><span>{title}</span>{extra}</div>
      <div style={{ padding: '12px 14px', flex: 1, minHeight: 0 }}>{node}</div>
    </div>
  )

  const tab = (key: BottomTab, label: string) => (
    <button
      key={key}
      onClick={() => setBottomTab(key)}
      style={{
        padding: '10px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        background: 'none', border: 'none',
        borderBottom: `2px solid ${bottomTab === key ? 'var(--ac)' : 'transparent'}`,
        color: bottomTab === key ? 'var(--ac2)' : 'var(--txt3)',
        fontFamily: 'var(--sans)', transition: '.1s',
      }}
    >{label}</button>
  )

  const recentCard = (
    <div style={card}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--brd)', padding: '0 8px' }}>
        {tab('recent', `Recent trades (${closed.length})`)}
        {tab('open', `Open positions (${open.length})`)}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', maxHeight: '230px' }}>
        {bottomTab === 'recent'
          ? <RecentTrades trades={filtered} onSelect={setSelected} />
          : <OpenPositions trades={open} onSelect={setSelected} />}
      </div>
    </div>
  )

  return (
    <>
      {/* Backup / Restore */}
      <BackupRestore userId={userId} onRestored={onReload} />

      {/* KPI cards */}
      <DashboardKPIs kpi={kpi} openCount={open.length} openPnl={openPnl} />

      {/* Row 1: Cumulative | Net daily | Recent trades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginTop: '12px', marginBottom: '12px', alignItems: 'stretch' }}>
        {chartCard(
          'Daily net cumulative P&L',
          <CumulativeChart labels={cumulative.labels} data={cumulative.data} />,
          <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', fontWeight: 700, color: kpi.netPnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>
            {kpi.netPnl >= 0 ? '+' : ''}${kpi.netPnl.toFixed(2)}
          </span>
        )}
        {chartCard('Net daily P&L', <DailyPnlChart days={dailyPnl} />)}
        {recentCard}
      </div>

      {/* Row 2: Calendar + weekly | Drawdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '12px', marginBottom: '12px', alignItems: 'stretch' }}>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
          <MonthCalendar days={dailyPnl} trades={filtered} />
        </div>
        {chartCard(
          'Drawdown',
          <DrawdownChart labels={drawdown.labels} data={drawdown.data} />,
          maxDD < 0 ? <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--red)' }}>Max ${maxDD.toFixed(2)}</span> : null
        )}
      </div>

      <TradePanel
        trade={selected}
        onClose={() => setSelected(null)}
        onEdit={t => { setSelected(null); onEdit(t) }}
        onDelete={id => { onDelete(id); setSelected(null) }}
      />
    </>
  )
}
