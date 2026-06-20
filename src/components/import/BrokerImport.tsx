'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { DasImport } from './DasImport'
import { TosImport } from './TosImport'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

type Broker = {
  id: string
  name: string
  description: string
  available: boolean
  icon: React.ReactNode
}

const brokers: Broker[] = [
  {
    id: 'das',
    name: 'DAS Trader',
    description: 'Import from DAS Trader Pro export',
    available: true,
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#1a2744"/>
        <text x="18" y="24" textAnchor="middle" fontSize="13" fontWeight="800" fill="#4A9EFF" fontFamily="monospace">DAS</text>
      </svg>
    ),
  },
  {
    id: 'tos',
    name: 'ThinkOrSwim',
    description: 'Import from TOS Account Statement CSV',
    available: true,
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#1a1a2e"/>
        <path d="M8 18 L14 10 L22 24 L26 18" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="26" cy="18" r="2.5" fill="#00D4AA"/>
      </svg>
    ),
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    description: 'Coming soon',
    available: false,
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#cc0000" opacity="0.15"/>
        <text x="18" y="24" textAnchor="middle" fontSize="11" fontWeight="800" fill="#cc0000" fontFamily="sans-serif">IBKR</text>
      </svg>
    ),
  },
  {
    id: 'webull',
    name: 'Webull',
    description: 'Coming soon',
    available: false,
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#00b07c" opacity="0.15"/>
        <text x="18" y="24" textAnchor="middle" fontSize="10" fontWeight="800" fill="#00b07c" fontFamily="sans-serif">WB</text>
      </svg>
    ),
  },
  {
    id: 'tastytrade',
    name: 'Tastytrade',
    description: 'Coming soon',
    available: false,
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#ff6b35" opacity="0.15"/>
        <text x="18" y="24" textAnchor="middle" fontSize="10" fontWeight="800" fill="#ff6b35" fontFamily="sans-serif">TT</text>
      </svg>
    ),
  },
  {
    id: 'tradestation',
    name: 'TradeStation',
    description: 'Coming soon',
    available: false,
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#f5a623" opacity="0.15"/>
        <text x="18" y="24" textAnchor="middle" fontSize="10" fontWeight="800" fill="#f5a623" fontFamily="sans-serif">TS</text>
      </svg>
    ),
  },
]

export function BrokerImport({ userId, existingTrades, onImported }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = brokers.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  // Show importer for selected broker
  if (selected === 'das') {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}
        >
          ← Back to brokers
        </button>
        <DasImport userId={userId} existingTrades={existingTrades} onImported={onImported} />
      </div>
    )
  }

  if (selected === 'tos') {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}
        >
          ← Back to brokers
        </button>
        <TosImport userId={userId} existingTrades={existingTrades} onImported={onImported} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Choose your broker</div>
        <div style={{ fontSize: '13px', color: 'var(--txt3)' }}>Select your trading platform to import your trades</div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '28px' }}>
        <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="fi"
          type="text"
          placeholder="Search broker or trading platform..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '34px', width: '100%' }}
        />
      </div>

      {/* Available brokers */}
      <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        Supported
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {filtered.filter(b => b.available).map(broker => (
          <button
            key={broker.id}
            onClick={() => setSelected(broker.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px 18px',
              background: 'var(--bg2)', border: '1px solid var(--brd)',
              borderRadius: '12px', cursor: 'pointer',
              textAlign: 'left', transition: '.15s',
              width: '100%',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#10B981'
              e.currentTarget.style.background = 'rgba(16,185,129,.04)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--brd)'
              e.currentTarget.style.background = 'var(--bg2)'
            }}
          >
            <div style={{ flexShrink: 0 }}>{broker.icon}</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{broker.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>{broker.description}</div>
            </div>
            <svg style={{ marginLeft: 'auto', opacity: 0.3, flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        ))}
      </div>

      {/* Coming soon brokers */}
      {filtered.filter(b => !b.available).length > 0 && (
        <>
          <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Coming Soon
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {filtered.filter(b => !b.available).map(broker => (
              <div
                key={broker.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px 18px',
                  background: 'var(--bg2)', border: '1px solid var(--brd)',
                  borderRadius: '12px', opacity: 0.5,
                  cursor: 'not-allowed',
                }}
              >
                <div style={{ flexShrink: 0 }}>{broker.icon}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{broker.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>Coming soon</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  SOON
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
