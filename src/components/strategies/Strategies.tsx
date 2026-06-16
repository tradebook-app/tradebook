'use client'

import { useState, useEffect } from 'react'
import type { StrategyRow } from '@/lib/types'
import {
  fetchStrategies, insertStrategy, updateStrategy, deleteStrategy,
  uploadStrategyImage, getStrategyImageUrl,
} from '@/lib/strategyService'
import { Modal } from '@/components/ui/Modal'

type Props = { userId: string }

export function Strategies({ userId }: Props) {
  const [strategies, setStrategies] = useState<StrategyRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(false)
  const [editing,    setEditing]    = useState<StrategyRow | null>(null)
  const [lightbox,   setLightbox]   = useState<string | null>(null)

  // Form state
  const [name,     setName]     = useState('')
  const [rules,    setRules]    = useState('')
  const [imgFile,  setImgFile]  = useState<File | null>(null)
  const [imgPrev,  setImgPrev]  = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  // Image URLs cache
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
    setEditing(null); setName(''); setRules('')
    setImgFile(null); setImgPrev(null); setModal(true)
  }

  function openEdit(s: StrategyRow) {
    setEditing(s); setName(s.name); setRules(s.rules || '')
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
      const updated = await updateStrategy(editing.id, { name, rules, img_url: imgUrl })
      if (updated) setStrategies(prev => prev.map(s => s.id === editing.id ? updated : s))
    } else {
      const inserted = await insertStrategy({ name, rules, img_url: imgUrl }, userId)
      if (inserted) setStrategies(prev => [inserted, ...prev])
    }

    setSaving(false); setModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this strategy?')) return
    const ok = await deleteStrategy(id)
    if (ok) setStrategies(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>Trading Strategies</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' }}>
            Your playbook — document setups, rules, and chart examples
          </div>
        </div>
        <button className="btn btn-p" onClick={openNew}>+ New Strategy</button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px' }}>Loading...</div>
      ) : strategies.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px', color: 'var(--txt3)',
          background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>📋</div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>No strategies yet</div>
          <div style={{ fontSize: '11px', marginBottom: '16px' }}>
            Document your trading setups, entry rules, and chart examples
          </div>
          <button className="btn btn-p" onClick={openNew}>+ Add First Strategy</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {strategies.map(s => {
            const imgUrl = s.img_url ? imgUrls[s.img_url] : null
            return (
              <div
                key={s.id}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--brd)',
                  borderRadius: 'var(--r2)', overflow: 'hidden',
                }}
              >
                {/* Chart image */}
                {imgUrl ? (
                  <div
                    style={{ height: '160px', overflow: 'hidden', background: 'var(--bg4)', cursor: 'zoom-in' }}
                    onClick={() => setLightbox(imgUrl)}
                  >
                    <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    height: '100px', background: 'var(--bg4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--txt4)', fontSize: '11px',
                  }}>
                    No chart image
                  </div>
                )}

                {/* Content */}
                <div style={{ padding: '14px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>{s.name}</div>

                  {s.rules && (
                    <div style={{
                      fontSize: '11px', color: 'var(--txt2)', lineHeight: 1.7,
                      whiteSpace: 'pre-line',
                      display: '-webkit-box', WebkitLineClamp: 5,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      marginBottom: '12px',
                    }}>
                      {s.rules}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-o"
                      onClick={() => openEdit(s)}
                      style={{ fontSize: '10px', padding: '4px 10px' }}
                    >✎ Edit</button>
                    <button
                      className="btn btn-d"
                      onClick={() => handleDelete(s.id)}
                    >✕ Delete</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
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
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Strategy Name</label>
          <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bull Flag Breakout" autoFocus />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Rules & Notes</label>
          <textarea
            className="fi"
            value={rules}
            onChange={e => setRules(e.target.value)}
            rows={8}
            placeholder={`Entry criteria:\n- ...\n\nExit rules:\n- ...\n\nWhat to avoid:\n- ...`}
          />
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
      </Modal>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
          }}
        >
          <img src={lightbox} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 'var(--r)', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
