'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { TastytradeImport } from './TastytradeImport'
import { TastytradeAutoSync } from './TastytradeAutoSync'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

export function TastytradeMethodSelect({ userId, existingTrades, onImported }: Props) {
  const [method, setMethod] = useState<'choose' | 'sync' | 'upload'>('choose')

  if (method === 'upload') {
    return (
      <div>
        <button onClick={() => setMethod('choose')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
          ← Back to import method
        </button>
        <TastytradeImport userId={userId} existingTrades={existingTrades} onImported={onImported} />
      </div>
    )
  }

  if (method === 'sync') {
    return (
      <div>
        <button onClick={() => setMethod('choose')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
          ← Back to import method
        </button>
        <TastytradeAutoSync userId={userId} existingTrades={existingTrades} onImported={onImported} />
      </div>
    )
  }

  const optionCard: React.CSSProperties = {
    flex: 1, minWidth: '220px', padding: '24px 20px', background: 'var(--bg2)',
    border: '1px solid var(--brd)', borderRadius: '12px',
    cursor: 'pointer', textAlign: 'center', transition: '.15s',
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Select Import Method</div>
        <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '28px' }}>You're linking Tastytrade</div>
      </div>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <div
          onClick={() => setMethod('sync')}
          style={optionCard}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#10B981' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)' }}
        >
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', fontWeight: 700, color: 'var(--ac2)', background: 'var(--ac-d)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '999px', padding: '2px 10px', whiteSpace: 'nowrap' }}>RECOMMENDED</span>
          </div>
          <div style={{ fontSize: '28px', marginBottom: '10px', marginTop: '6px' }}>🔄</div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>Auto-sync</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>Connect your account — trades sync automatically</div>
        </div>

        <div
          onClick={() => setMethod('upload')}
          style={optionCard}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#10B981' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)' }}
        >
          <div style={{ fontSize: '28px', marginBottom: '10px', marginTop: '20px' }}>📄</div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>File upload</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>Upload your Tastytrade transaction CSV</div>
        </div>
      </div>
    </div>
  )
}
