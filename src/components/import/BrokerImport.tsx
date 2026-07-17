'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { DasImport } from './DasImport'
import { TosImport } from './TosImport'
import { IbkrImport } from './IbkrImport'
import { IbkrMethodSelect } from './IbkrMethodSelect'
import { WebullImport } from './WebullImport'
import { WebullMethodSelect } from './WebullMethodSelect'
import { TastytradeImport } from './TastytradeImport'
import { TastytradeMethodSelect } from './TastytradeMethodSelect'
import { TradeStationImport } from './TradeStationImport'
import { Mt4Import } from './Mt4Import'
import { TradovateImport } from './TradovateImport'
import { NinjaTraderImport } from './NinjaTraderImport'

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
  logo: string
  bg: string
}

const brokers: Broker[] = [
  { id: 'das', name: 'DAS Trader', description: 'Import from DAS Trader Pro export', available: true, logo: '/brokers/das.png', bg: '#0A1628' },
  { id: 'tos', name: 'ThinkOrSwim', description: 'Import from TOS Account Statement CSV', available: true, logo: '/brokers/tos.png', bg: '#0D1F0D' },
  { id: 'ibkr', name: 'Interactive Brokers', description: 'Auto-sync or import Activity Statement', available: true, logo: '/brokers/ibkr.png', bg: '#1A0A0A' },
  { id: 'webull', name: 'Webull', description: 'Auto-sync or import order history CSV', available: true, logo: '/brokers/webull.png', bg: '#0A1A14' },
  { id: 'tastytrade', name: 'Tastytrade', description: 'Auto-sync or import transaction CSV', available: true, logo: '/brokers/tastytrade.png', bg: '#1A0E06' },
  { id: 'tradestation', name: 'TradeStation', description: 'Import from TradeStation activity CSV', available: true, logo: '/brokers/tradestation.png', bg: '#1A1400' },
  { id: 'mt4', name: 'MT4 / MT5', description: 'Import from Account History report (forex)', available: true, logo: '/brokers/mt4.png', bg: '#0A1220' },
  { id: 'tradovate', name: 'Tradovate', description: 'Import from Orders CSV export (futures)', available: true, logo: '/brokers/tradovate.png', bg: '#0F1A0A' },
  { id: 'ninjatrader', name: 'NinjaTrader', description: 'Import from NinjaTrader Web Orders CSV (futures)', available: true, logo: '/brokers/ninjatrader.png', bg: '#12121A' },
]

function BrokerIcon({ logo, bg, name }: { logo: string; bg: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  if (failed) {
    return (
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
        {initials}
      </div>
    )
  }
  return (
    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      <img src={logo} alt={name} width={24} height={24} onError={() => setFailed(true)} style={{ objectFit: 'contain' }} />
    </div>
  )
}

export function BrokerImport({ userId, existingTrades, onImported }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = brokers.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))

  const backBtn = (
    <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
      ← Back to brokers
    </button>
  )

  if (selected === 'das')          return <div>{backBtn}<DasImport userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>
  if (selected === 'tos')          return <div>{backBtn}<TosImport userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>
  if (selected === 'ibkr')         return <div>{backBtn}<IbkrMethodSelect userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>
  if (selected === 'webull')       return <div>{backBtn}<WebullMethodSelect userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>
  if (selected === 'tastytrade')   return <div>{backBtn}<TastytradeMethodSelect userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>
  if (selected === 'tradestation') return <div>{backBtn}<TradeStationImport userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>
  if (selected === 'mt4')          return <div>{backBtn}<Mt4Import userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>
  if (selected === 'tradovate')    return <div>{backBtn}<TradovateImport userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>
  if (selected === 'ninjatrader')  return <div>{backBtn}<NinjaTraderImport userId={userId} existingTrades={existingTrades} onImported={onImported} /></div>

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
        <input className="fi" type="text" autoComplete="off" name="broker-search" placeholder="Search broker or trading platform..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '34px', width: '100%' }} />
      </div>

      <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Supported</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {filtered.filter(b => b.available).map(broker => (
          <button key={broker.id} onClick={() => setSelected(broker.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: '.15s', width: '100%' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.background = 'rgba(16,185,129,.04)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)'; e.currentTarget.style.background = 'var(--bg2)' }}
          >
            <BrokerIcon logo={broker.logo} bg={broker.bg} name={broker.name} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{broker.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>{broker.description}</div>
            </div>
            <svg style={{ marginLeft: 'auto', opacity: 0.3, flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        ))}
      </div>

      {filtered.filter(b => !b.available).length > 0 && (
        <>
          <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Coming Soon</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {filtered.filter(b => !b.available).map(broker => (
              <div key={broker.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', opacity: 0.5, cursor: 'not-allowed' }}>
                <BrokerIcon logo={broker.logo} bg={broker.bg} name={broker.name} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{broker.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>Coming soon</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>SOON</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
