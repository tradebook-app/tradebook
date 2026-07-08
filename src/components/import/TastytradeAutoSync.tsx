'use client'

import { useState, useEffect } from 'react'
import type { TradeRow } from '@/lib/types'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

type ConnStatus = {
  accountNumber: string | null
  last_synced_at: string | null
  last_status: string | null
  last_error: string | null
  created_at: string
} | null

export function TastytradeAutoSync({ onImported }: Props) {
  const [connection, setConnection] = useState<ConnStatus>(null)
  const [loading, setLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  async function loadStatus() {
    setLoading(true)
    const res = await fetch('/api/broker/tastytrade/status')
    const json = await res.json()
    setConnection(json.connection || null)
    setLoading(false)
  }

  useEffect(() => { loadStatus() }, [])

  async function handleConnect() {
    setFormError(null)
    setSaving(true)
    const res = await fetch('/api/broker/tastytrade/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret, refreshToken }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(json.error || 'Failed to connect.'); return }
    setClientSecret('')
    setRefreshToken('')
    await loadStatus()
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Tastytrade? You can reconnect anytime.')) return
    await fetch('/api/broker/tastytrade/disconnect', { method: 'POST' })
    setSyncResult(null)
    await loadStatus()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/broker/tastytrade/sync', { method: 'POST' })
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
  }

  if (loading) {
    return <div style={{ padding: '8px', textAlign: 'center', color: 'var(--txt3)', fontSize: '13px' }}>Loading...</div>
  }

  if (connection) {
    return (
      <div style={{ padding: '8px' }}>
        <div style={{ ...card, maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800 }}>Tastytrade — connected</div>
            <button onClick={handleDisconnect} style={{ fontSize: '12px', color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Disconnect</button>
          </div>
          {connection.accountNumber && (
            <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '4px' }}>Account: {connection.accountNumber}</div>
          )}
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

  const step = (n: number, title: string, body: string) => (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
      <div style={{
        flexShrink: 0, width: '22px', height: '22px', borderRadius: '999px',
        background: 'var(--ac-d)', color: 'var(--ac2)', fontSize: '11px', fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px',
      }}>{n}</div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)', lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px', textAlign: 'center' }}>Connect Tastytrade</div>
      <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '20px', textAlign: 'center' }}>
        You'll need a Client Secret and a Refresh Token from your Tastytrade account.
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 320px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '14px' }}>Your credentials</div>
          <input className="fi" placeholder="Client Secret" value={clientSecret} onChange={e => setClientSecret(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} type="password" />
          <input className="fi" placeholder="Refresh Token" value={refreshToken} onChange={e => setRefreshToken(e.target.value)} style={{ width: '100%', marginBottom: '14px' }} type="password" />
          {formError && (
            <div style={{ marginBottom: '12px', background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: 'var(--red)' }}>
              ⚠️ {formError}
            </div>
          )}
          <button className="btn btn-p" onClick={handleConnect} disabled={saving || !clientSecret.trim() || !refreshToken.trim()} style={{ width: '100%' }}>
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </div>

        <div style={{ flex: '1 1 380px', border: '1px solid var(--brd)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', background: 'var(--bg3)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>📋 Step-by-step setup guide</span>
          </div>
          <div style={{ padding: '16px 14px' }}>
            {step(1, 'Log into my.tastytrade.com', 'Use a browser, not the mobile app.')}
            {step(2, 'Open the API section', 'Hover over My Profile (top right) → click API in the dropdown.')}
            {step(3, 'Create an OAuth application', 'Give it any name (e.g. "Sleektrade"). Add http://localhost:8000 as the callback URL — it\'s required but won\'t actually be used here. Read and accept the terms, then create the application.')}
            {step(4, 'Copy the Client Secret', 'Shown right after creating the application — copy and save it now, it won\'t be shown again in full.')}
            {step(5, 'Create a grant', 'On the same OAuth Applications page, click Manage on your new application → Create Grant. This generates your Refresh Token.')}
            {step(6, 'Copy the Refresh Token', 'Copy the token shown after creating the grant.')}
            <div style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 'var(--r)', padding: '10px 12px', marginTop: '6px', fontSize: '11px', color: '#3B82F6', lineHeight: 1.6 }}>
              ℹ️ These credentials only allow reading your account data — they can't place trades or move money.
            </div>
            <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '14px' }}>
              Once you have both values, paste them into the form.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
