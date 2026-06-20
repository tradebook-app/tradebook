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

const DASIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="#0A1628"/>
    <rect x="7" y="9" width="22" height="2.5" rx="1.25" fill="#4A9EFF"/>
    <rect x="7" y="14" width="16" height="2.5" rx="1.25" fill="#4A9EFF" opacity="0.6"/>
    <rect x="7" y="19" width="10" height="2.5" rx="1.25" fill="#4A9EFF" opacity="0.3"/>
    <polyline points="7,29 12,23 17,26 24,18 29,20" fill="none" stroke="#4A9EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="29" cy="20" r="2" fill="#4A9EFF"/>
  </svg>
)

const TOSIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="#0D1F0D"/>
    {[0,45,90,135,180,225,270,315].map((angle, i) => {
      const rad = (angle * Math.PI) / 180
      const x1 = 18 + 6 * Math.cos(rad)
      const y1 = 18 + 6 * Math.sin(rad)
      const x2 = 18 + 13 * Math.cos(rad)
      const y2 = 18 + 13 * Math.sin(rad)
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#00C853" strokeWidth="2" strokeLinecap="round"/>
    })}
    <circle cx="18" cy="18" r="4" fill="#00C853"/>
  </svg>
)

const IBKRIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="#1A0A0A"/>
    <rect x="8" y="8" width="8" height="20" rx="1.5" fill="#CC0000"/>
    <rect x="8" y="8" width="20" height="6" rx="1.5" fill="#CC0000"/>
    <rect x="8" y="15" width="14" height="5" rx="1.5" fill="#CC0000"/>
    <rect x="8" y="22" width="20" height="6" rx="1.5" fill="#CC0000"/>
  </svg>
)

const WebullIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="#0A1A14"/>
    <circle cx="18" cy="18" r="10" stroke="#00C896" strokeWidth="2.5" fill="none"/>
    <circle cx="18" cy="18" r="5" fill="#00C896"/>
    <line x1="18" y1="6" x2="18" y2="10" stroke="#00C896" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="18" y1="26" x2="18" y2="30" stroke="#00C896" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="6" y1="18" x2="10" y2="18" stroke="#00C896" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="26" y1="18" x2="30" y2="18" stroke="#00C896" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)

const TastyIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="#1A0E06"/>
    <path d="M18 8 C10 8 7 14 7 18 C7 24 12 29 18 29 C24 29 29 24 29 18 C29 14 26 8 18 8Z" fill="#FF6B35" opacity="0.15"/>
    <path d="M18 11 C13 11 10 15 10 18 C10 22 13 26 18 26 C23 26 26 22 26 18 C26 15 23 11 18 11Z" stroke="#FF6B35" strokeWidth="2" fill="none"/>
    <path d="M14 18 C14 16 16 14 18 14 C20 14 22 16 22 18" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <circle cx="18" cy="21" r="2.5" fill="#FF6B35"/>
  </svg>
)

const TSIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="#1A1400"/>
    <polygon points="18,7 22,14 29,15 24,21 25,28 18,24 11,28 12,21 7,15 14,14" fill="none" stroke="#F5A623" strokeWidth="2" strokeLinejoin="round"/>
    <polygon points="18,12 20.5,16.5 25,17.2 21.5,20.5 22.3,25 18,22.7 13.7,25 14.5,20.5 11,17.2 15.5,16.5" fill="#F5A623"/>
  </svg>
)

const brokers: Broker[] = [
  {
    id: 'das',
    name: 'DAS Trader',
    description: 'Import from DAS Trader Pro export',
    available: true,
    icon: <DASIcon />,
  },
  {
    id: 'tos',
    name: 'ThinkOrSwim',
    description: 'Import from TOS Account Statement CSV',
    available: true,
    icon: <TOSIcon />,
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    description: 'Coming soon',
    available: false,
    icon: <IBKRIcon />,
  },
  {
    id: 'webull',
    name: 'Webull',
    description: 'Coming soon',
    available: false,
    icon: <WebullIcon />,
  },
  {
    id: 'tastytrade',
    name: 'Tastytrade',
    description: 'Coming soon',
    available: false,
    icon: <TastyIcon />,
  },
  {
    id: 'tradestation',
    name: 'TradeStation',
    description: 'Coming soon',
    available: false,
    icon: <TSIcon />,
  },
]

export function BrokerImport({ userId, existingTrades, onImported }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = brokers.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

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
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Choose your broker</div>
        <div style={{ fontSize: '13px', color: 'var(--txt3)' }}>Select your trading platform to import your trades</div>
      </div>

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
