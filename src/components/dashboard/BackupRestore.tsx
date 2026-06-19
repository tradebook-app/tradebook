'use client'

import { useState, useRef } from 'react'
import { fetchTrades, insertTrade } from '@/lib/tradeService'
import { fetchNotes, insertNote } from '@/lib/noteService'
import { fetchStrategies, insertStrategy } from '@/lib/strategyService'
import type { TradeInsert, NoteInsert, StrategyInsert } from '@/lib/types'

type Props = {
  userId: string
  onRestored: () => void
}

// Remove server-managed fields so the object matches the *Insert shape
function strip<T extends Record<string, unknown>>(o: T) {
  const { id, user_id, created_at, updated_at, ...rest } = o as Record<string, unknown>
  return rest
}

export function BackupRestore({ userId, onRestored }: Props) {
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function backup() {
    if (busy) return
    setBusy('backup')
    setMsg('')
    try {
      const [trades, notes, strategies] = await Promise.all([
        fetchTrades(), fetchNotes(), fetchStrategies(),
      ])
      const data = {
        app: 'SLEEKTRADE',
        v: 1,
        exportedAt: new Date().toISOString(),
        counts: { trades: trades.length, notes: notes.length, strategies: strategies.length },
        trades, notes, strategies,
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sleektrade-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg(`Backed up ${trades.length} trades, ${notes.length} notes, ${strategies.length} strategies`)
    } catch (err) {
      setMsg(err instanceof Error ? `Backup failed: ${err.message}` : 'Backup failed')
    }
    setBusy(null)
  }

  async function restore(file: File) {
    if (busy) return
    setBusy('restore')
    setMsg('')
    try {
      const data = JSON.parse(await file.text())
      const existing = await fetchTrades()
      let tC = 0, nC = 0, sC = 0

      if (Array.isArray(data.trades)) {
        for (const t of data.trades) {
          const dsT = (t.date || '').substring(0, 10)
          const dup = existing.some(x =>
            x.symbol === t.symbol &&
            (x.date || '').substring(0, 10) === dsT &&
            Number(x.pnl) === Number(t.pnl) &&
            Math.round(x.shares || 0) === Math.round(t.shares || 0)
          )
          if (dup) continue
          const r = await insertTrade(strip(t) as TradeInsert, userId)
          if (r) tC++
        }
      }
      if (Array.isArray(data.notes)) {
        for (const n of data.notes) {
          const r = await insertNote(strip(n) as NoteInsert, userId)
          if (r) nC++
        }
      }
      if (Array.isArray(data.strategies)) {
        for (const s of data.strategies) {
          const r = await insertStrategy(strip(s) as StrategyInsert, userId)
          if (r) sC++
        }
      }
      setMsg(`Restored ${tC} trades, ${nC} notes, ${sC} strategies (duplicates skipped)`)
      onRestored()
    } catch (err) {
      setMsg(err instanceof Error ? `Restore failed: ${err.message}` : 'Restore failed — invalid file?')
    }
    setBusy(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const btn: React.CSSProperties = {
    background: 'var(--bg4, #1a1a24)', border: '1px solid var(--brd2, #333)',
    color: 'var(--txt2)', borderRadius: 'var(--r, 7px)', padding: '6px 12px',
    fontSize: '11px', fontWeight: 600, cursor: busy ? 'default' : 'pointer',
    fontFamily: 'var(--sans)', opacity: busy ? 0.6 : 1,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {msg && <span style={{ fontSize: '10px', color: 'var(--txt3)', marginRight: 'auto' }}>{msg}</span>}
      <button style={btn} onClick={backup} disabled={!!busy}>
        {busy === 'backup' ? 'Backing up…' : '💾 Backup'}
      </button>
      <button style={btn} onClick={() => fileRef.current?.click()} disabled={!!busy}>
        {busy === 'restore' ? 'Restoring…' : '📂 Restore'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) restore(f) }}
      />
    </div>
  )
}
