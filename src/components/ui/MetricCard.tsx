'use client'

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

type Props = {
  label: string
  value: string | number
  valueColor?: string
  sub?: React.ReactNode
  gauge?: { pct: number; color: string }
  tooltip?: string
}

export function MetricCard({ label, value, valueColor, sub, gauge, tooltip }: Props) {
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
          {tooltip && (
            <span title={tooltip} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '13px', height: '13px', borderRadius: '50%',
              border: '1.5px solid var(--txt3)', color: 'var(--txt3)',
              fontSize: '8px', fontWeight: 700, cursor: 'help',
              marginLeft: '3px', verticalAlign: 'middle',
            }}>i</span>
          )}
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
      {gauge && <Gauge pct={gauge.pct} color={gauge.color} />}
    </div>
  )
}
