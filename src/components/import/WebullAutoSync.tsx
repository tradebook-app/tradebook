'use client'

import { useState, useEffect, useRef } from 'react'
import type { TradeRow } from '@/lib/types'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: () => void
}

type ConnStatus = {
  tokenStatus: 'pending' | 'verified' | 'failed'
  tokenExpiresAt: string | null
  last_synced_at: string | null
  last_status: string | null
  last_error: string | null
  created_at: string
} | null

export function WebullAutoSync({ onImported }: Props) {
  const [connection, setConnection] = useState<ConnStatus>(null)
  const [loading, setLoading] = useState(true)
  const [appKey, setAppKey] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [pollElapsed, setPollElapsed] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadStatus() {
    const res = await fetch('/api/broker/webull/status')
    const json = await res.json()
    setConnection(json.connection || null)
    setLoading(false)
    return json.connection as ConnStatus
  }

  useEffect(() => { loadStatus() }, [])

  useEffect(() => {
    if (connection?.tokenStatus === 'pending') {
      setPollElapsed(0)
      pollRef.current = setInterval(async () => {
        setPollElapsed(e => e + 5)
        const updated = await loadStatus()
        if (updated?.tokenStatus !== 'pending' && pollRef.current) {
          clearInterval(pollRef.current)
        }
      }, 5000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [connection?.tokenStatus])

  async function handleConnect() {
    setFormError(null)
    setSaving(true)
    const res = await fetch('/api/broker/webull/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey, appSecret }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(json.error || 'Failed to connect.'); return }
    setAppKey('')
    setAppSecret('')
    await loadStatus()
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Webull? You can reconnect anytime.')) return
    await fetch('/api/broker/webull/disconnect', { method: 'POST' })
    setSyncResult(null)
    await loadStatus()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/broker/webull/sync', { method: 'POST' })
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

  // ── Pending verification: waiting for the user to approve via SMS / the Webull App ──
  if (connection?.tokenStatus === 'pending') {
    const timedOut = pollElapsed >= 300
    return (
      <div style={{ padding: '8px' }}>
        <div style={{ ...card, maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>📱</div>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '8px' }}>
            {timedOut ? 'Verification timed out' : 'Waiting for approval'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)', lineHeight: 1.6, marginBottom: '18px' }}>
            {timedOut
              ? 'The verification request expired. Disconnect and try again.'
              : 'Open the Webull App on your phone and approve the sign-in request. This checks automatically every few seconds.'}
          </div>
          {!timedOut && (
            <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '18px' }}>
              Waiting... {pollElapsed}s / 300s
            </div>
          )}
          <button onClick={handleDisconnect} className="btn" style={{ fontSize: '12px' }}>
            Cancel and disconnect
          </button>
        </div>
      </div>
    )
  }

  // ── Verified and connected ──
  if (connection?.tokenStatus === 'verified') {
    const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null
    const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
    const expiringSoon = daysLeft !== null && daysLeft <= 3

    return (
      <div style={{ padding: '8px' }}>
        <div style={{ ...card, maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800 }}>Webull — connected</div>
            <button onClick={handleDisconnect} style={{ fontSize: '12px', color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Disconnect</button>
          </div>

          {daysLeft !== null && (
            <div style={{
              fontSize: '12px', marginBottom: '10px',
              color: expiringSoon ? 'var(--orange)' : 'var(--txt3)',
            }}>
              {expiringSoon
                ? `⚠️ Access expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — reconnect soon to avoid interruption`
                : `Access expires in ${daysLeft} days (Webull tokens auto-expire every 15 days — you'll need to reconnect periodically)`}
            </div>
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

  // ── Not connected (or failed) — show the connect form ──
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
      <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px', textAlign: 'center' }}>Connect Webull</div>
      <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '20px', textAlign: 'center' }}>
        You'll need an App Key and App Secret from Webull's OpenAPI portal.
      </div>

      <div style={{ background: 'var(--orange-d)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: 'var(--orange)', maxWidth: '760px', margin: '0 auto 20px' }}>
        ⚠️ Webull requires approving your API application first (usually 1-2 business days), and access tokens expire every 15 days — you'll need to reconnect periodically. This is a Webull limitation, not something Sleektrade controls.
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 320px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '14px' }}>Your credentials</div>
          <input className="fi" placeholder="App Key" value={appKey} onChange={e => setAppKey(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} type="password" />
          <input className="fi" placeholder="App Secret" value={appSecret} onChange={e => setAppSecret(e.target.value)} style={{ width: '100%', marginBottom: '14px' }} type="password" />
          {formError && (
            <div style={{ marginBottom: '12px', background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: 'var(--red)' }}>
              ⚠️ {formError}
            </div>
          )}
          <button className="btn btn-p" onClick={handleConnect} disabled={saving || !appKey.trim() || !appSecret.trim()} style={{ width: '100%' }}>
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </div>

        <div style={{ flex: '1 1 380px', border: '1px solid var(--brd)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', background: 'var(--bg3)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>📋 Step-by-step setup guide</span>
          </div>
          <div style={{ padding: '16px 14px' }}>
            {step(1, 'Apply for OpenAPI access', 'Log into webull.com → find OpenAPI Management → submit the individual application. Approval usually takes 1-2 business days.')}
            {step(2, 'Generate your App Key and App Secret', 'Once approved, generate these from the Webull Developer Portal. Copy both — the secret is shown only once.')}
            {step(3, 'Paste them into the form', 'After you click Connect, you\'ll be asked to approve the connection from your phone.')}
            {step(4, 'Approve on your phone', 'Open the Webull App and approve the verification request — you have 5 minutes.')}
            <div style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 'var(--r)', padding: '10px 12px', marginTop: '6px', fontSize: '11px', color: '#3B82F6', lineHeight: 1.6 }}>
              ℹ️ These credentials only allow reading your account data — they can't place trades or move money.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
