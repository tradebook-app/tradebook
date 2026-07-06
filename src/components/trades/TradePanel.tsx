'use client'

import { useEffect, useState, useMemo } from 'react'
import type { TradeRow } from '@/lib/types'
import { fmtPnl, fmtDate, holdTime } from '@/lib/analytics'
import { getScreenshotUrl } from '@/lib/tradeService'
import TradeChart, { Candle, TradeMarker } from '@/components/charts/TradeChart'

type Props = {
  trade: TradeRow | null
  trades: TradeRow[]
  onClose: () => void
  onEdit: (trade: TradeRow) => void
  onDelete: (id: string) => void
  onNavigate: (trade: TradeRow) => void
}

type Tab = 'chart' | 'stats' | 'notes' | 'screenshot' | 'tags'
type ChartTimeframe = '15min' | '1h' | '1day'

export function TradePanel({ trade, trades, onClose, onEdit, onDelete, onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>('stats')
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)
  const [chartInterval, setChartInterval] = useState<string>('15min')
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('15min')

  const currentIndex = trade ? trades.findIndex(t => t.id === trade.id) : -1

  useEffect(() => {
    if (trade?.screenshot_url) {
      getScreenshotUrl(trade.screenshot_url).then(setScreenshotUrl)
    } else {
      setScreenshotUrl(null)
    }
    setTab('stats')
    setCandles([])
    setChartError(null)
    setSelectedTimeframe('15min')
  }, [trade])

  // Keyboard navigation
  useEffect(() => {
    if (!trade) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentIndex > 0) onNavigate(trades[currentIndex - 1])
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentIndex < trades.length - 1) onNavigate(trades[currentIndex + 1])
      }
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [trade, currentIndex, trades, onNavigate, onClose])

  // Fetch candle data whenever Chart tab is open, trade changes, or timeframe changes
  useEffect(() => {
    if (tab !== 'chart' || !trade) return

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
  }, [tab, trade, selectedTimeframe])

  const markers: TradeMarker[] = useMemo(() => {
    if (!trade) return []
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
    if (trade.exit_date && trade.exit) {
      const isWin = trade.pnl > 0
      result.push({
        time: formatTime(trade.exit_date),
        position: trade.type === 'Short' ? 'belowBar' : 'aboveBar',
        color: isWin ? '#22c55e' : '#ef4444',
        shape: trade.type === 'Short' ? 'arrowUp' : 'arrowDown',
        text: `Exit $${trade.exit}`,
      })
    }
    return result
  }, [trade, chartInterval])

  if (!trade) return null

  const isWin  = trade.pnl > 0
  const isLoss = trade.pnl < 0
  const roi    = trade.entry && trade.shares ? (trade.pnl / (trade.entry * trade.shares)) * 100 : 0
  const rm     = trade.risk > 0 ? trade.pnl / trade.risk : null
  const hold   = holdTime(trade.date, trade.exit_date)

  const statusColor = isWin ? 'var(--ac)' : isLoss ? 'var(--red)' : 'var(--txt3)'
  const statusBg    = isWin ? 'var(--ac-d)' : isLoss ? 'var(--red-d)' : 'rgba(255,255,255,.06)'
  const statusLabel = isWin ? 'WIN' : isLoss ? 'LOSS' : 'BE'

  const TABS: { key: Tab; label: string }[] = [
    { key: 'chart',      label: 'Chart' },
    { key: 'stats',      label: 'Stats' },
    { key: 'notes',      label: 'Notes' },
    { key: 'screenshot', label: 'Screenshot' },
    { key: 'tags',       label: 'Tags' },
  ]

  const TIMEFRAMES: { key: ChartTimeframe; label: string }[] = [
    { key: '15min', label: '15m' },
    { key: '1h',    label: '1H' },
    { key: '1day',  label: '1D' },
  ]

  const STATS = [
    ['Side',        <span style={{ color: trade.type === 'Short' ? 'var(--red)' : 'var(--ac)', fontWeight: 700 }}>{trade.type?.toUpperCase()}</span>],
    ['Symbol',      trade.symbol],
    ['Entry Price', `$${trade.entry}`],
    ['Exit Price',  trade.exit ? `$${trade.exit}` : '—'],
    ['Shares',      trade.shares || '—'],
    ['Setup',       trade.setup || '—'],
    ['Grade',       trade.grade || '—'],
    ['Risk (1R)',   `$${trade.risk || 0}`],
    ['Commissions', `$${trade.commission || 0}`],
    ['Net ROI',     <span style={{ color: roi >= 0 ? 'var(--ac)' : 'var(--red)' }}>{roi >= 0 ? '+' : ''}{roi.toFixed(2)}%</span>],
    ['R-Multiple',  rm !== null ? <span style={{ color: rm >= 0 ? 'var(--ac)' : 'var(--red)' }}>{rm >= 0 ? '+' : ''}{rm.toFixed(2)}R</span> : '—'],
    ['Hold Time',   hold],
    ['Gross P&L',   fmtPnl(trade.pnl + (trade.commission || 0))],
    ['Net P&L',     <span style={{ color: statusColor, fontWeight: 700 }}>{fmtPnl(trade.pnl)}</span>],
  ] as [string, React.ReactNode][]

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      width: '560px', maxWidth: '100vw', height: '100vh',
      background: 'var(--bg2)',
      borderLeft: '1px solid var(--brd)',
      zIndex: 151, overflowY: 'auto',
      boxShadow: '-4px 0 30px rgba(0,0,0,.4)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--brd)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Trade Preview</div>
          {/* Arrow nav */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => currentIndex > 0 && onNavigate(trades[currentIndex - 1])}
              disabled={currentIndex <= 0}
              title="Previous trade (↑)"
              style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '5px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer', opacity: currentIndex <= 0 ? 0.3 : 1, color: 'var(--txt2)', fontSize: '12px' }}
            >↑</button>
            <button
              onClick={() => currentIndex < trades.length - 1 && onNavigate(trades[currentIndex + 1])}
              disabled={currentIndex >= trades.length - 1}
              title="Next trade (↓)"
              style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '5px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentIndex >= trades.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIndex >= trades.length - 1 ? 0.3 : 1, color: 'var(--txt2)', fontSize: '12px' }}
            >↓</button>
            <span style={{ fontSize: '9px', color: 'var(--txt3)', alignSelf: 'center', marginLeft: '2px' }}>{currentIndex + 1}/{trades.length}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--txt3)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
      </div>

      {/* Symbol header */}
      <div style={{ padding: '16px 20px', background: 'var(--bg3)', borderBottom: '1px solid var(--brd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--mono)' }}>{trade.symbol}</span>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: trade.type === 'Short' ? 'var(--red-d)' : 'var(--ac-d)', color: trade.type === 'Short' ? 'var(--red)' : 'var(--ac)' }}>{trade.type}</span>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--bg5)', color: 'var(--txt2)' }}>{trade.exit ? 'Closed' : 'Open'}</span>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: statusBg, color: statusColor }}>{statusLabel}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '6px' }}>
          Opened {fmtDate(trade.date)}
          {trade.exit_date && ` · Closed ${fmtDate(trade.exit_date)}`}
          {' · '}Held {hold}
        </div>
      </div>

      {/* P&L box */}
      <div style={{ padding: '16px 20px', background: 'var(--bg4)', borderBottom: '1px solid var(--brd)' }}>
        <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '2px' }}>NET P&L</div>
        <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'var(--mono)', color: statusColor }}>
          {fmtPnl(trade.pnl)}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          {[
            `ROI ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`,
            `Gross ${fmtPnl(trade.pnl + (trade.commission || 0))}`,
            rm !== null ? `${rm >= 0 ? '+' : ''}${rm.toFixed(2)}R` : null,
          ].filter(Boolean).map((t, i) => (
            <span key={i} style={{ fontSize: '10px', fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg5)', color: 'var(--txt2)' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--brd)', padding: '0 20px' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${tab === key ? 'var(--ac)' : 'transparent'}`, color: tab === key ? 'var(--ac2)' : 'var(--txt3)', fontFamily: 'var(--sans)', transition: '.1s' }}>{label}</button>
        ))}
      </div>

      {/* Tab body */}
      <div style={{ padding: '16px 20px' }}>
        {tab === 'chart' && (
          <>
            {/* Timeframe selector */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {TIMEFRAMES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedTimeframe(key)}
                  style={{
                    padding: '5px 12px',
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '5px',
                    cursor: 'pointer',
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
              <>
                <TradeChart candles={candles} markers={markers} height={480} />
                {chartInterval !== selectedTimeframe && (
                  <div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '6px', textAlign: 'center' }}>
                    Showing {chartInterval === '1day' ? 'daily' : chartInterval} data — {selectedTimeframe === '1day' ? 'daily' : selectedTimeframe} unavailable for this date range.
                  </div>
                )}
              </>
            )}
          </>
        )}
        {tab === 'stats' && STATS.map(([label, val], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--brd)' }}>
            <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{label}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--mono)' }}>{val}</span>
          </div>
        ))}
        {tab === 'notes' && (trade.notes ? <div style={{ fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{trade.notes}</div> : <div style={{ color: 'var(--txt3)', fontSize: '11px' }}>No notes. Click Edit to add.</div>)}
        {tab === 'screenshot' && (screenshotUrl ? <img src={screenshotUrl} style={{ width: '100%', borderRadius: 'var(--r)', border: '1px solid var(--brd)', cursor: 'pointer' }} onClick={() => window.open(screenshotUrl, '_blank')} /> : <div style={{ color: 'var(--txt3)', fontSize: '11px' }}>No screenshot attached.</div>)}
        {tab === 'tags' && ((trade.tags || []).length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{trade.tags.map((t, i) => <span key={i} style={{ fontSize: '11px', padding: '4px 10px', margin: '3px', borderRadius: '3px', background: 'var(--bg)', border: '1px solid var(--brd2)', color: 'var(--txt2)' }}>{t}</span>)}</div> : <div style={{ color: 'var(--txt3)', fontSize: '11px' }}>No tags. Click Edit to add.</div>)}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--brd)', display: 'flex', gap: '8px', position: 'sticky', bottom: 0, background: 'var(--bg2)' }}>
        <button className="btn btn-o" onClick={onClose}>Close</button>
        <button className="btn btn-d" onClick={() => { if (confirm('Delete this trade?')) { onDelete(trade.id); onClose() } }} style={{ marginLeft: 'auto' }}>🗑 Delete</button>
        <button className="btn btn-p" onClick={() => onEdit(trade)}>✎ Edit</button>
      </div>
    </div>
  )
}
