'use client'

import { useState, useMemo, useEffect } from 'react'
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

  // $ / % toggle for the cumulative chart
  const [cumMode, setCumMode] = useState<'$' | '%'>('$')
  const [accountSize, setAccountSize] = useState<number>(0)
  useEffect(() => {
    const saved = localStorage.getItem('tb_account_size')
    if (saved) setAccountSize(parseFloat(saved) || 0)
  }, [])
  function updateAccountSize(v: number) {
    setAccountSize(v)
    localStorage.setItem('tb_account_size', String(v || ''))
  }
  const cumPct = useMemo(
    () => accountSize > 0 ? cumulative.data.map(v => parseFloat((v / accountSize * 100).toFixed(2))) : [],
    [cumulative, accountSize]
  )
  const netPct = accountSize > 0 ? (kpi.netPnl / accountSize) * 100 : 0
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
          (cumMode === '%' && accountSize <= 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: 'var(--txt3)', fontSize: '11px', textAlign: 'center', padding: '0 20px' }}>
              <span>Enter your account size to see your return %.</span>
              <input
                type="number"
                value={accountSize || ''}
                onChange={e => updateAccountSize(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 30000"
                style={{ width: '140px', background: 'var(--bg4, #16161e)', border: '1px solid var(--brd2, #2a2a35)', color: 'var(--txt)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: '12px', fontFamily: 'var(--mono)', textAlign: 'center' }}
              />
            </div>
          ) : (
            <CumulativeChart
              labels={cumulative.labels}
              data={cumMode === '%' ? cumPct : cumulative.data}
              unit={cumMode}
            />
          ),
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {cumMode === '%' && accountSize > 0 && (
              <input
                type="number"
                value={accountSize || ''}
                onChange={e => updateAccountSize(parseFloat(e.target.value) || 0)}
                title="Account size"
                style={{ width: '64px', background: 'var(--bg4, #16161e)', border: '1px solid var(--brd2, #2a2a35)', color: 'var(--txt2)', borderRadius: '5px', padding: '2px 6px', fontSize: '10px', fontFamily: 'var(--mono)' }}
              />
            )}
            <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', fontWeight: 700, color: kpi.netPnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>
              {cumMode === '%'
                ? (accountSize > 0 ? `${netPct >= 0 ? '+' : ''}${netPct.toFixed(2)}%` : '—')
                : `${kpi.netPnl >= 0 ? '+' : ''}$${kpi.netPnl.toFixed(2)}`}
            </span>
            <div style={{ display: 'flex', background: 'var(--bg4, #16161e)', border: '1px solid var(--brd2, #2a2a35)', borderRadius: '6px', overflow: 'hidden' }}>
              {(['$', '%'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setCumMode(m)}
                  style={{
                    border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700, padding: '3px 9px',
                    fontFamily: 'var(--mono)',
                    background: cumMode === m ? 'var(--ac)' : 'transparent',
                    color: cumMode === m ? '#000' : 'var(--txt3)',
                  }}
                >{m}</button>
              ))}
            </div>
          </div>
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
