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
      <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px', textAlign: 'center' }}>Connect Interactive Brokers</div>
      <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '20px', textAlign: 'center' }}>
        You'll need two things from IBKR's Client Portal: a Flex Query ID and a Flex Web Service Token.
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 320px', maxWidth: 'none', margin: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '14px' }}>Your credentials</div>
          <input className="fi" placeholder="Flex Web Service Token" value={flexToken} onChange={e => setFlexToken(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} type="password" />
          <input className="fi" placeholder="Flex Query ID" value={flexQueryId} onChange={e => setFlexQueryId(e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
          {formError && (
            <div style={{ marginBottom: '12px', background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '11px', color: 'var(--red)' }}>
              ⚠️ {formError}
            </div>
          )}
          <button className="btn btn-p" onClick={handleConnect} disabled={saving || !flexToken.trim() || !flexQueryId.trim()} style={{ width: '100%' }}>
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </div>

        <div style={{ flex: '1 1 380px' }}>
          <SetupGuide />
        </div>
      </div>
    </div>
  )
}

function SetupGuide() {
  const step = (n: number, title: string, body: React.ReactNode) => (
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
    <div style={{ border: '1px solid var(--brd)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', background: 'var(--bg3)' }}>
        <span style={{ fontSize: '12px', fontWeight: 700 }}>📋 Step-by-step setup guide</span>
      </div>

      <div style={{ padding: '16px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
            Part 1 — Create the Flex Query
          </div>

          {step(1, 'Log into IBKR Client Portal', 'Use a browser at ibkr.com and log in — this must be Client Portal, not the Trader Workstation desktop app.')}
          {step(2, 'Go to Flex Queries', 'Click Performance & Reports (left menu) → Flex Queries.')}
          {step(3, 'Create a new Activity Flex Query', 'Click the "+" icon. Give it any name, e.g. "Sleektrade Sync".')}
          {step(4, 'Add the Trades section', 'Under "Sections", enable Trades, then select these fields specifically: Symbol, Date/Time, Quantity, T. Price, Proceeds, Comm/Fee, Basis, Realized P/L, Code.')}

          <div style={{ background: 'var(--orange-d)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 'var(--r)', padding: '10px 12px', margin: '4px 0 14px 34px', fontSize: '11px', color: 'var(--orange)' }}>
            ⚠️ Set <strong>Format to CSV</strong>, not XML. Most tutorials online default to XML — Sleektrade needs CSV to read it correctly.
          </div>

          {step(5, 'Set the date range', 'Choose "Last 30 Calendar Days" (or longer). This controls how far back each sync can look.')}
          {step(6, 'Save and copy the Query ID', 'Click Continue → Create. Back on the Flex Queries list, find your new query and note the numeric ID next to it — that\'s your Query ID.')}

          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '18px 0 10px' }}>
            Part 2 — Get your Flex Web Service Token
          </div>

          {step(7, 'Open Flex Web Service Configuration', 'Still under Performance & Reports → Flex Queries, find "Flex Web Service Configuration" (a separate section on the same page).')}
          {step(8, 'Enable it', 'Check the box next to Flex Web Service Status, then click Save.')}
          {step(9, 'Generate a token', 'Set the expiration to the longest option available (up to 1 year) so you don\'t have to reconnect often. Leave the IP field blank unless you want to restrict access. Click Generate New Token.')}
          {step(10, 'Copy the token', 'Copy the long string shown as "Current Token" — this is your Flex Web Service Token.')}

          <div style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 'var(--r)', padding: '10px 12px', marginTop: '6px', fontSize: '11px', color: '#3B82F6', lineHeight: 1.6 }}>
            ℹ️ This token is read-only — it can only pull reports. It can't place trades, move money, or change anything in your IBKR account.
          </div>

          <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '14px' }}>
            Once you have both values, paste them into the form.
          </div>
        </div>
    </div>
  )
}
