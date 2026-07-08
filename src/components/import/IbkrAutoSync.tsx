'use client'

import { useState, useEffect } from 'react'
import type { TradeRow } from '@/lib/types'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

type ConnStatus = {
  flex_query_id: string
  last_synced_at: string | null
  last_status: string | null
  last_error: string | null
  created_at: string
} | null

export function IbkrAutoSync({ onImported }: Props) {
  const [connection, setConnection] = useState<ConnStatus>(null)
  const [loading, setLoading] = useState(true)
  const [flexToken, setFlexToken] = useState('')
  const [flexQueryId, setFlexQueryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  async function loadStatus() {
    setLoading(true)
    const res = await fetch('/api/broker/ibkr/status')
    const json = await res.json()
    setConnection(json.connection || null)
    setLoading(false)
  }

  useEffect(() => { loadStatus() }, [])

  async function handleConnect() {
    setFormError(null)
    setSaving(true)
    const res = await fetch('/api/broker/ibkr/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flexToken, flexQueryId }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(json.error || 'Failed to connect.'); return }
    setFlexToken('')
    setFlexQueryId('')
    await loadStatus()
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect IBKR? You can reconnect anytime with a new token.')) return
    await fetch('/api/broker/ibkr/disconnect', { method: 'POST' })
    setSyncResult(null)
    await loadStatus()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/broker/ibkr/sync', { method: 'POST' })
    const json = await res.json()
    setSyncing(false)
    if (!res.ok) { setSyncResult(`Error: ${json.error}`); await loadStatus(); return }
    const parts = [`${json.imported} trade${json.imported !== 1 ? 's' : ''} imported`]
    if (json.skippedDuplicates > 0) parts.push(`${json.skippedDuplicates} duplicate${json.skippedDuplicates !== 1 ? 's' : ''} skipped`)
    if (json.carriedForward?.length > 0) {
      const cf = json.carriedForward.map((c: any) => `${c.qty} sh ${c.symbol}`).join(', ')
      parts.push(`still open: ${cf}`)
    }
    setSyncResult(parts.join(' · '))
    await loadStatus()
    if (json.imported > 0) onImported()
  }

  const card: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--brd)',
    borderRadius: 'var(--r2)', padding: '20px',
    maxWidth: '640px', margin: '0 auto',
  }

  if (loading) {
    return <div style={{ padding: '8px', textAlign: 'center', color: 'var(--txt3)', fontSize: '13px' }}>Loading...</div>
  }

  if (connection) {
    return (
      <div style={{ padding: '8px' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800 }}>Interactive Brokers — connected</div>
            <button onClick={handleDisconnect} style={{ fontSize: '12px', color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Disconnect</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '4px' }}>Query ID: {connection.flex_query_id}</div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '18px' }}>
            {connection.last_synced_at
              ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()} — ${connection.last_status === 'success' ? 'success' : `failed: ${connection.last_error}`}`
              : 'Never synced yet'}
          </div>
          <button className="btn btn-p" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          {syncResult && (
            <div style={{ marginTop: '12px', background: syncResult.startsWith('Error') ? 'var(--red-d)' : 'rgba(16,185,129,.1)', border: `1px solid ${syncResult.startsWith('Error') ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)'}`, borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: syncResult.startsWith('Error') ? 'var(--red)' : 'var(--ac2)' }}>
              {syncResult}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={card}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Connect Interactive Brokers</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '18px', lineHeight: 1.6 }}>
          In IBKR Client Portal: Performance &amp; Reports → Flex Queries → create a Trades Flex Query with the standard Trades fields (Symbol, Date/Time, Quantity, T. Price, Proceeds, Comm/Fee, Basis, Realized P/L, Code), format <strong>CSV</strong>. Then Settings → Flex Web Service → enable it and generate a token.
        </div>
        <input className="fi" placeholder="Flex Web Service Token" value={flexToken} onChange={e => setFlexToken(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} type="password" />
        <input className="fi" placeholder="Flex Query ID" value={flexQueryId} onChange={e => setFlexQueryId(e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
        {formError && (
          <div style={{ marginBottom: '12px', background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: 'var(--red)' }}>
            ⚠️ {formError}
          </div>
        )}
        <button className="btn btn-p" onClick={handleConnect} disabled={saving || !flexToken.trim() || !flexQueryId.trim()}>
          {saving ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  )
}
