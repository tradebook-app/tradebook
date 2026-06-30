'use client'

import { useState, useEffect, useMemo } from 'react'
import type { StrategyRow, TradeRow } from '@/lib/types'
import {
  fetchStrategies, insertStrategy, updateStrategy, deleteStrategy,
  uploadStrategyImage, getStrategyImageUrl,
} from '@/lib/strategyService'
import { calcStrategyStats, fmtPnl } from '@/lib/analytics'
import { Modal } from '@/components/ui/Modal'
import { StrategyDetail } from '@/components/strategies/StrategyDetail'

type Props = { userId: string; trades: TradeRow[] }
type ViewMode = 'grid' | 'list'

export function Strategies({ userId, trades }: Props) {
  const [strategies, setStrategies] = useState<StrategyRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState<ViewMode>('grid')
  const [search,     setSearch]     = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Create / edit modal
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState<StrategyRow | null>(null)
  const [name,    setName]    = useState('')
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPrev, setImgPrev] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  // Signed image URL cache
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchStrategies().then(data => { setStrategies(data); setLoading(false) })
  }, [])

  useEffect(() => {
    strategies.forEach(s => {
      if (s.img_url && !imgUrls[s.img_url]) {
        getStrategyImageUrl(s.img_url).then(url => {
          if (url) setImgUrls(prev => ({ ...prev, [s.img_url!]: url }))
        })
      }
    })
  }, [strategies])

  function openNew() {
    setEditing(null); setName('')
    setImgFile(null); setImgPrev(null); setModal(true)
  }

  function openEdit(s: StrategyRow) {
    setEditing(s); setName(s.name)
    setImgFile(null); setImgPrev(null); setModal(true)
  }

  function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setImgFile(f)
    const reader = new FileReader()
    reader.onload = ev => setImgPrev(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleSave() {
    if (!name.trim()) return alert('Enter a strategy name')
    setSaving(true)

    let imgUrl = editing?.img_url || null
    if (imgFile) imgUrl = await uploadStrategyImage(imgFile, userId)

    if (editing) {
      const updated = await updateStrategy(editing.id, { name, img_url: imgUrl })
      if (updated) setStrategies(prev => prev.map(s => s.id === editing.id ? updated : s))
    } else {
      const inserted = await insertStrategy({ name, rules: null, img_url: imgUrl }, userId)
      if (inserted) setStrategies(prev => [inserted, ...prev])
    }

    setSaving(false); setModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this strategy? Rules and stats for it will be removed. Trades stay untouched.')) return
    const ok = await deleteStrategy(id)
    if (ok) {
      setStrategies(prev => prev.filter(s => s.id !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return strategies
    return strategies.filter(s => s.name.toLowerCase().includes(q))
  }, [strategies, search])

  const selected = selectedId ? strategies.find(s => s.id === selectedId) || null : null

  // ─── Detail view ────────────────────────────────────────────────────────
  if (selected) {
    return (
      <StrategyDetail
        strategy={selected}
        trades={trades}
        imgUrl={selected.img_url ? imgUrls[selected.img_url] || null : null}
        onBack={() => setSelectedId(null)}
        onEdit={() => openEdit(selected)}
        onDelete={() => handleDelete(selected.id)}
      />
    )
  }

  // ─── List / grid view ───────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>Trading Strategies</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' }}>
            Your playbook — rules, chart examples, and real performance per strategy
          </div>
        </div>
        <button className="btn btn-p" onClick={openNew}>+ New Strategy</button>
      </div>

      {/* Toolbar */}
      {strategies.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <input
            className="fi"
            placeholder="Search strategies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: '260px' }}
          />
          <div style={{ display: 'flex', marginLeft: 'auto', border: '1px solid var(--brd2)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <button
              onClick={() => setView('grid')}
              style={{
                padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                background: view === 'grid' ? 'var(--bg4)' : 'transparent',
                color: view === 'grid' ? 'var(--txt)' : 'var(--txt3)',
                border: 'none', fontFamily: 'var(--sans)',
              }}
            >▦ Grid</button>
            <button
              onClick={() => setView('list')}
              style={{
                padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                background: view === 'list' ? 'var(--bg4)' : 'transparent',
                color: view === 'list' ? 'var(--txt)' : 'var(--txt3)',
                border: 'none', borderLeft: '1px solid var(--brd2)', fontFamily: 'var(--sans)',
              }}
            >☰ List</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="empty">Loading...</div>
      ) : strategies.length === 0 ? (
        <div className="empty" style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '60px' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>📋</div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--txt)' }}>No strategies yet</div>
          <div style={{ fontSize: '11px', marginBottom: '16px' }}>
            Build a playbook entry, then tag trades to it to see real win rate and P&L
          </div>
          <button className="btn btn-p" onClick={openNew}>+ Add First Strategy</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">No strategies match &ldquo;{search}&rdquo;</div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filtered.map(s => {
            const imgUrl = s.img_url ? imgUrls[s.img_url] : null
            const stats = calcStrategyStats(trades, s)
            return (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--brd)',
                  borderRadius: 'var(--r2)', overflow: 'hidden', cursor: 'pointer',
                  transition: 'border-color .12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brd3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brd)')}
              >
                {imgUrl ? (
                  <div style={{ height: '140px', overflow: 'hidden', background: 'var(--bg4)' }}>
                    <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    height: '72px', background: 'var(--bg4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--txt4)', fontSize: '20px',
                  }}>📈</div>
                )}

                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(s) }}
                        style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
                      >✎</button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                        style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
                      >✕</button>
                    </div>
                  </div>

                  {stats.trades === 0 ? (
                    <div style={{ fontSize: '10px', color: 'var(--txt4)' }}>No trades tagged yet</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '8px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Win Rate</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: stats.winRate >= 50 ? 'var(--ac)' : 'var(--red)' }}>{stats.winRate.toFixed(0)}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '8px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Trades</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)' }}>{stats.trades}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '8px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Net P&L</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: stats.netPnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtPnl(stats.netPnl, true)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Strategy</th>
                <th className="r">Trades</th>
                <th className="r">Win Rate</th>
                <th className="r">Profit Factor</th>
                <th className="r">Net P&L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const stats = calcStrategyStats(trades, s)
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(s.id)}>
                    <td style={{ fontWeight: 700 }}>{s.name}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)' }}>{stats.trades}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', color: stats.trades ? (stats.winRate >= 50 ? 'var(--ac)' : 'var(--red)') : 'var(--txt4)' }}>
                      {stats.trades ? `${stats.winRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', color: stats.trades ? (stats.profitFactor >= 1.5 ? 'var(--ac)' : 'var(--red)') : 'var(--txt4)' }}>
                      {stats.trades ? stats.profitFactor.toFixed(2) : '—'}
                    </td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: stats.trades ? (stats.netPnl >= 0 ? 'var(--ac)' : 'var(--red)') : 'var(--txt4)' }}>
                      {stats.trades ? fmtPnl(stats.netPnl) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(s) }}
                          style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '12px', padding: '2px 6px' }}
                        >✎</button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                          style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '12px', padding: '2px 6px' }}
                        >✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New / Edit modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? `Edit: ${editing.name}` : 'New Strategy'}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Strategy'}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Strategy Name</label>
          <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bull Flag Breakout" autoFocus />
          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>
            Use this exact name as the &ldquo;Setup&rdquo; on trades to link them here automatically.
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Chart Example (optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label className="btn btn-o" style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgChange} />
              📷 Upload Chart
            </label>
            {imgPrev && <img src={imgPrev} style={{ height: '40px', borderRadius: '4px', border: '1px solid var(--brd)' }} />}
            {!imgPrev && editing?.img_url && <span style={{ fontSize: '10px', color: 'var(--ac)' }}>✓ Chart saved</span>}
          </div>
        </div>

        {!editing && (
          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '14px', padding: '10px 12px', background: 'var(--bg4)', borderRadius: 'var(--r)' }}>
            You'll be able to add entry/exit rules and see win rate, profit factor, and net P&L right after saving.
          </div>
        )}
      </Modal>
    </div>
  )
}
