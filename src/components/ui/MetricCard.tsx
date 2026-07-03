'use client'
import { useState } from 'react'

type GaugeProps = {
  pct: number
  color: string
}

function Gauge({ pct, color }: GaugeProps) {
  const p = Math.max(0, Math.min(pct, 100))
  const r = 20
  const arcLen = Math.PI * r
  const fill = arcLen * (p / 100)

  return (
    <svg width="55" height="38" viewBox="0 0 56 38" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M8,30 A20,20 0 0,1 48,30" fill="none" stroke="var(--brd3)" strokeWidth="5" strokeLinecap="round" />
      {p > 0 && (
        <path
          d="M8,30 A20,20 0 0,1 48,30"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${arcLen}`}
        />
      )}
    </svg>
  )
}

type WinLossBarProps = {
  avgWin: number
  avgLoss: number
}

function WinLossBar({ avgWin, avgLoss }: WinLossBarProps) {
  const win = Math.max(0, avgWin)
  const loss = Math.max(0, Math.abs(avgLoss))
  const total = win + loss
  const winPct = total > 0 ? (win / total) * 100 : 50
  const lossPct = 100 - winPct

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '90px', flexShrink: 0 }}>
      <div style={{
        display: 'flex',
        width: '100%',
        height: '6px',
        borderRadius: '3px',
        overflow: 'hidden',
        background: 'var(--brd3)',
      }}>
        <div style={{ width: `${winPct}%`, background: 'var(--ac)' }} />
        <div style={{ width: `${lossPct}%`, background: 'var(--red)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--mono)' }}>
        <span style={{ color: 'var(--ac)' }}>+${win.toFixed(0)}</span>
        <span style={{ color: 'var(--red)' }}>-${loss.toFixed(0)}</span>
      </div>
    </div>
  )
}

type InfoTooltipProps = {
  text: string
}

function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: '3px' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '13px', height: '13px', borderRadius: '50%',
        border: '1.5px solid var(--txt3)', color: 'var(--txt3)',
        fontSize: '8px', fontWeight: 700, cursor: 'default',
      }}>i</span>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg4)',
          border: '1px solid var(--brd)',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '10px',
          fontWeight: 400,
          color: 'var(--txt)',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,.35)',
          zIndex: 20,
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

type Props = {
  label: string
  value: string | number
  valueColor?: string
  sub?: React.ReactNode
  gauge?: { pct: number; color: string }
  winLossBar?: { avgWin: number; avgLoss: number }
  tooltip?: string
}

export function MetricCard({ label, value, valueColor, sub, gauge, winLossBar, tooltip }: Props) {
  return (
    <div style={{
      background: 'var(--bg3)',
      border: '1px solid var(--brd)',
      borderRadius: 'var(--r2)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: '80px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', color: 'var(--txt2)', marginBottom: '2px' }}>
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div style={{
          fontSize: '22px', fontWeight: 800,
          fontFamily: 'var(--mono)',
          color: valueColor || 'var(--txt)',
        }}>
          {value}
        </div>
        {sub && <div style={{ marginTop: '3px' }}>{sub}</div>}
      </div>
      {winLossBar
        ? <WinLossBar avgWin={winLossBar.avgWin} avgLoss={winLossBar.avgLoss} />
        : gauge && <Gauge pct={gauge.pct} color={gauge.color} />}
    </div>
  )
}
