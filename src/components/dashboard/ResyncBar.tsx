'use client'

import { useState, useEffect } from 'react'

type Props = {
  onReload: () => void
}

type Connection = {
  broker: string
  lastSyncedAt: string | null
  lastStatus: string | null
  lastError: string | null
}

export function ResyncBar({ onReload }: Props) {
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/broker/status-all')
      .then(r => r.json())
      .then(json => setConnections(json.connections || []))
      .catch(() => setConnections([]))
  }, [])

  if (!connections || connections.length === 0) return null

  const mostRecent = connections
    .map(c => c.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0]

  async function handleResync() {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/broker/resync-all', { method: 'POST' })
      const json = await res.json()
      setSyncing(false)
      if (!res.ok) { setResult(`Error: ${json.error}`); return }
      setResult(`${json.totalImported} trade${json.totalImported !== 1 ? 's' : ''} imported`)
      const statusRes = await fetch('/api/broker/status-all')
      const statusJson = await statusRes.json()
      setConnections(statusJson.connections || [])
      if (json.totalImported > 0) onReload()
    } catch (err: any) {
      setSyncing(false)
      setResult('Error: could not reach the server')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--txt3)', marginBottom: '14px' }}>
      <span>
        Last import: {mostRecent ? new Date(mostRecent).toLocaleString() : 'never'}
      </span>
      <button
        onClick={handleResync}
        disabled={syncing}
        style={{ background: 'none', border: 'none', color: 'var(--ac2)', cursor: syncing ? 'default' : 'pointer', fontSize: '12px', fontWeight: 600, padding: 0, opacity: syncing ? 0.6 : 1, textDecoration: 'underline' }}
      >
        {syncing ? 'Syncing...' : 'Resync'}
      </button>
      {result && (
        <span style={{ color: result.startsWith('Error') ? 'var(--red)' : 'var(--ac2)' }}>{result}</span>
      )}
    </div>
  )
}
