'use client'

import Link from 'next/link'

type Props = {
  feature: string
  description: string
  onClose?: () => void
}

export function UpgradeWall({ feature, description, onClose }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
      minHeight: '300px',
    }}>
      <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔒</div>
      <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--txt)' }}>
        {feature}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--txt2)', lineHeight: 1.6, maxWidth: '380px', marginBottom: '28px' }}>
        {description}
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/billing" style={{
          fontSize: '14px', fontWeight: 700, color: '#000',
          background: '#10B981', borderRadius: '8px',
          padding: '11px 24px', textDecoration: 'none',
        }}>
          Upgrade to Pro — $19/mo
        </Link>
        {onClose && (
          <button onClick={onClose} style={{
            fontSize: '14px', fontWeight: 500, color: 'var(--txt2)',
            background: 'var(--bg3)', border: '1px solid var(--brd)',
            borderRadius: '8px', padding: '11px 20px', cursor: 'pointer',
            fontFamily: 'var(--sans)',
          }}>
            Maybe later
          </button>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '14px' }}>
        No commitment · Cancel anytime
      </div>
    </div>
  )
}

// Banner version — shown inline at top of page
export function UpgradeBanner({ tradeCount, limit = 50 }: { tradeCount: number, limit?: number }) {
  const pct = Math.min((tradeCount / limit) * 100, 100)
  const nearLimit = tradeCount >= limit * 0.8
  const atLimit = tradeCount >= limit

  if (!nearLimit) return null

  return (
    <div style={{
      background: atLimit ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)',
      border: `1px solid ${atLimit ? 'rgba(239,68,68,.2)' : 'rgba(245,158,11,.2)'}`,
      borderRadius: 'var(--r)', padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '12px', marginBottom: '16px', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <span style={{ fontSize: '14px' }}>{atLimit ? '🚫' : '⚠️'}</span>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: atLimit ? 'var(--red)' : 'var(--orange, #f59e0b)' }}>
            {atLimit ? 'Trade limit reached' : `${limit - tradeCount} trades remaining this month`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>
            {tradeCount} / {limit} trades used · Upgrade to Pro for unlimited trades
          </div>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ width: '120px', height: '6px', background: 'var(--bg4)', borderRadius: '3px', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: atLimit ? 'var(--red)' : '#f59e0b', borderRadius: '3px', transition: '.3s' }} />
      </div>
      <Link href="/billing" style={{
        fontSize: '11px', fontWeight: 700, color: '#000',
        background: '#10B981', borderRadius: '6px',
        padding: '6px 14px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        Upgrade →
      </Link>
    </div>
  )
}
