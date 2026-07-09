'use client'

import { useState } from 'react'
import type { TradeRow } from '@/lib/types'
import { WebullImport } from './WebullImport'
import { WebullAutoSync } from './WebullAutoSync'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

export function WebullMethodSelect({ userId, existingTrades, onImported }: Props) {
  const [method, setMethod] = useState<'choose' | 'sync' | 'upload'>('choose')

  if (method === 'upload') {
    return (
      <div>
        <button onClick={() => setMethod('choose')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
          ← Back to import method
        </button>
        <WebullImport userId={userId} existingTrades={existingTrades} onImported={onImported} />
      </div>
    )
  }

  if (method === 'sync') {
    return (
      <div>
        <button onClick={() => setMethod('choose')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
          ← Back to import method
        </button>
        <WebullAutoSync userId={userId} existingTrades={existingTrades} onImported={onImported} />
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
        <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '28px' }}>You're linking Webull</div>
      </div>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <div
          onClick={() => setMethod('sync')}
          style={optionCard}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#10B981' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)' }}
        >
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔄</div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>Auto-sync</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>Connect your account (requires approved API access)</div>
        </div>

        <div
          onClick={() => setMethod('upload')}
          style={optionCard}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#10B981' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)' }}
        >
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>📄</div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>File upload</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>Upload your Webull order history CSV</div>
        </div>
      </div>
    </div>
  )
}
