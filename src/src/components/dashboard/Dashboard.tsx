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
import { TradePanel } from '@/components/trades/TradePanel'

type Props = {
  trades: TradeRow[]
  filter: DateRangeFilter
  onEdit: (t: TradeRow) => void
  onDelete: (id: string) => void
}

type BottomTab = 'recent' | 'open'

export function Dashboard({ trades, filter, onEdit, onDelete }: Props) {
  const [bottomTab, setBottomTab] = useState<BottomTab>('recent')
  const [selected,  setSelected]  = useState<TradeRow | null>(null)

  const filtered = useMemo(() => filterByDate(trades, filter), [trades, filter])
  const closed   = useMemo(() => closedTrades(filtered), [filtered])
  const open     = useMemo(() => openTrades(trades), [trades])   // open positions ignore date filter

  const kpi       = useMemo(() => calcKPIs(filtered), [filtered])
  const dailyPnl  = useMemo(() => calcDailyPnl(filtered), [filtered])
  const cumulative = useMemo(() => calcCumulative(filtered), [filtered])
  const drawdown  = useMemo(() => calcDrawdown(filtered), [filtered])
  const openPnl   = open.reduce((s, t) => s + (t.pnl || 0), 0)

  // Max drawdown
  const maxDD = drawdown.data.length ? Math.min(...drawdown.data) : 0

  const section = (title: string, node: React.ReactNode, extra?: React.ReactNode) => (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding: '14px 16px' }}>{node}</div>
    </div>
  )

  return (
    <>
      {/* KPIs */}
      <DashboardKPIs kpi={kpi} openCount={open.length} openPnl={openPnl} />

      {/* Row 1: Cumulative P&L + Calendar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '12px', marginBottom: '12px' }}>
        {section(
          'Cumulative P&L',
          <CumulativeChart labels={cumulative.labels} data={cumulative.data} />,
          <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: kpi.netPnl >= 0 ? 'var(--ac)' : 'var(--red)', fontWeight: 700 }}>
            {kpi.netPnl >= 0 ? '+' : ''}${kpi.netPnl.toFixed(2)}
          </span>
        )}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
          <MonthCalendar days={dailyPnl} />
        </div>
      </div>

      {/* Row 2: Daily P&L + Drawdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        {section('Daily P&L', <DailyPnlChart days={dailyPnl} />)}
        {section(
          'Drawdown',
          <DrawdownChart labels={drawdown.labels} data={drawdown.data} />,
          maxDD < 0
            ? <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--red)' }}>Max ${maxDD.toFixed(2)}</span>
            : null
        )}
      </div>

      {/* Row 3: Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Total Trades', val: String(kpi.totalTrades) },
          { label: 'Avg Win', val: kpi.avgWin > 0 ? `+$${kpi.avgWin.toFixed(0)}` : '—', color: 'var(--ac)' },
          { label: 'Avg Loss', val: kpi.avgLoss > 0 ? `-$${kpi.avgLoss.toFixed(0)}` : '—', color: 'var(--red)' },
          { label: 'Max DD', val: maxDD < 0 ? `$${maxDD.toFixed(0)}` : '—', color: 'var(--red)' },
          { label: 'Trading Days', val: String(dailyPnl.length) },
          { label: 'Green Days', val: String(dailyPnl.filter(d => d.pnl > 0).length), color: 'var(--ac)' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--bg3)', border: '1px solid var(--brd)',
            borderRadius: 'var(--r)', padding: '10px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '8px', color: 'var(--txt3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--mono)', color: s.color || 'var(--txt)' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Row 4: Recent trades + Open positions */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--brd)', padding: '0 16px' }}>
          {([
            { key: 'recent', label: `Recent Trades (${closed.length})` },
            { key: 'open',   label: `Open Positions (${open.length})` },
          ] as { key: BottomTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setBottomTab(key)}
              style={{
                padding: '10px 16px', fontSize: '11px', fontWeight: 600,
                cursor: 'pointer', background: 'none', border: 'none',
                borderBottom: `2px solid ${bottomTab === key ? 'var(--ac)' : 'transparent'}`,
                color: bottomTab === key ? 'var(--ac2)' : 'var(--txt3)',
                fontFamily: 'var(--sans)', transition: '.1s',
              }}
            >{label}</button>
          ))}
        </div>
        {bottomTab === 'recent'
          ? <RecentTrades trades={filtered} onSelect={setSelected} />
          : <OpenPositions trades={open} onSelect={setSelected} />
        }
      </div>

      {/* Trade preview panel */}
      <TradePanel
        trade={selected}
        onClose={() => setSelected(null)}
        onEdit={t => { setSelected(null); onEdit(t) }}
        onDelete={id => { onDelete(id); setSelected(null) }}
      />
    </>
  )
}
