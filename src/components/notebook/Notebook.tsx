'use client'

import { useState, useEffect } from 'react'
import type { NoteRow, TradeRow } from '@/lib/types'
import {
  fetchNotes, insertNote, updateNote, deleteNote,
  uploadNoteImage, getNoteImageUrl,
} from '@/lib/noteService'
import { fetchTrades, getScreenshotUrl } from '@/lib/tradeService'
import { Modal } from '@/components/ui/Modal'

type Props = { userId: string }
type Cat   = 'all' | 'trade' | 'my'

export function Notebook({ userId }: Props) {
  const [notes,    setNotes]    = useState<NoteRow[]>([])
  const [trades,   setTrades]   = useState<TradeRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [cat,      setCat]      = useState<Cat>('all')
  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState(false)
  const [editing,  setEditing]  = useState<NoteRow | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Form state
  const [title,    setTitle]    = useState('')
  const [body,     setBody]     = useState('')
  const [noteCat,  setNoteCat]  = useState<'trade' | 'my'>('my')
  const [imgFile,  setImgFile]  = useState<File | null>(null)
  const [imgPrev,  setImgPrev]  = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  // Image URL caches
  const [imgUrls,  setImgUrls]  = useState<Record<string, string>>({})
  const [shotUrls, setShotUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([fetchNotes(), fetchTrades()]).then(([n, t]) => {
      setNotes(n); setTrades(t); setLoading(false)
    })
  }, [])

  // Signed URLs for manual-note images
  useEffect(() => {
    notes.forEach(n => {
      if (n.img_url && !imgUrls[n.img_url]) {
        getNoteImageUrl(n.img_url).then(url => { if (url) setImgUrls(prev => ({ ...prev, [n.img_url!]: url })) })
      }
    })
  }, [notes])

  // Signed URLs for trade screenshots
  useEffect(() => {
    trades.forEach(t => {
      if (t.screenshot_url && !shotUrls[t.screenshot_url]) {
        getScreenshotUrl(t.screenshot_url).then(url => { if (url) setShotUrls(prev => ({ ...prev, [t.screenshot_url!]: url })) })
      }
    })
  }, [trades])

  function openNew() {
    setEditing(null); setTitle(''); setBody('')
    setNoteCat('my'); setImgFile(null); setImgPrev(null)
    setModal(true)
  }
  function openEdit(n: NoteRow) {
    setEditing(n); setTitle(n.title); setBody(n.body)
    setNoteCat(n.category as 'trade' | 'my')
    setImgFile(null); setImgPrev(null)
    setModal(true)
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
    if (!title.trim()) return alert('Enter a title')
    setSaving(true)
    let imgUrl = editing?.img_url || null
    if (imgFile) imgUrl = await uploadNoteImage(imgFile, userId)
    if (editing) {
      const updated = await updateNote(editing.id, { title, body, category: noteCat, img_url: imgUrl })
      if (updated) setNotes(prev => prev.map(n => n.id === editing.id ? updated : n))
    } else {
      const inserted = await insertNote({ title, body, category: noteCat, img_url: imgUrl }, userId)
      if (inserted) setNotes(prev => [inserted, ...prev])
    }
    setSaving(false); setModal(false)
  }
  async function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return
    const ok = await deleteNote(id)
    if (ok) setNotes(prev => prev.filter(n => n.id !== id))
  }

  const q = search.toLowerCase()

  // Manual notes (My Notes + any note tagged trade)
  const noteCards = notes
    .filter(n => cat === 'all' || n.category === cat)
    .filter(n => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))

  // Trade-derived cards: any trade that has a screenshot OR notes
  const tradeCards = (cat === 'all' || cat === 'trade')
    ? trades
        .filter(t => t.screenshot_url || (t.notes && t.notes.trim()))
        .filter(t => !q || t.symbol.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    : []

  const isEmpty = noteCards.length === 0 && tradeCards.length === 0
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all', 'trade', 'my'] as Cat[]).map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding: '5px 14px', borderRadius: 'var(--r)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            background: cat === c ? 'var(--ac)' : 'var(--bg4)',
            color: cat === c ? '#000' : 'var(--txt2)',
            border: '1px solid ' + (cat === c ? 'var(--ac)' : 'var(--brd2)'), fontFamily: 'var(--sans)',
          }}>
            {c === 'all' ? 'All Notes' : c === 'trade' ? 'Trade Notes' : 'My Notes'}
          </button>
        ))}
        <input className="fi" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." style={{ width: '180px', marginLeft: '4px' }} />
        <button className="btn btn-p" onClick={openNew} style={{ marginLeft: 'auto' }}>+ New Note</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px' }}>Loading...</div>
      ) : isEmpty ? (
        <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px', fontSize: '12px' }}>
          {cat === 'trade'
            ? 'No trade notes yet. Add a screenshot or notes to a trade and it will appear here.'
            : 'No notes yet. Click "+ New Note" to start your trading journal.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>

          {/* Trade-derived cards */}
          {tradeCards.map(t => {
            const shot = t.screenshot_url ? shotUrls[t.screenshot_url] : null
            const pnl = t.pnl || 0
            return (
              <div key={`trade-${t.id}`} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                {shot && (
                  <div style={{ height: '140px', overflow: 'hidden', background: 'var(--bg4)', cursor: 'zoom-in' }} onClick={() => setLightbox(shot)}>
                    <img src={shot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                      {t.symbol} <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{(t.type || 'Long')}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'var(--mono)', color: pnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>
                      {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                    </span>
                  </div>
                  {t.notes && t.notes.trim() && (
                    <div style={{ fontSize: '11px', color: 'var(--txt2)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '10px' }}>
                      {t.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '9px', color: 'var(--txt4)' }}>{t.date ? fmtDate(t.date) : ''}</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: 'var(--blue-d, rgba(59,130,246,.12))', color: 'var(--blue, #60a5fa)' }}>FROM TRADE</span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Manual note cards */}
          {noteCards.map(n => {
            const imgUrl = n.img_url ? imgUrls[n.img_url] : null
            return (
              <div key={n.id} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                {imgUrl && (
                  <div style={{ height: '140px', overflow: 'hidden', background: 'var(--bg4)', cursor: 'zoom-in' }} onClick={() => setLightbox(imgUrl)}>
                    <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, flex: 1, marginRight: '8px' }}>{n.title}</div>
                    <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', flexShrink: 0, background: n.category === 'trade' ? 'var(--blue-d, rgba(59,130,246,.12))' : 'var(--bg5)', color: n.category === 'trade' ? 'var(--blue, #60a5fa)' : 'var(--txt3)' }}>
                      {n.category === 'trade' ? 'TRADE' : 'MY NOTE'}
                    </span>
                  </div>
                  {n.body && (
                    <div style={{ fontSize: '11px', color: 'var(--txt2)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '10px' }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '9px', color: 'var(--txt4)' }}>{fmtDate(n.created_at)}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => openEdit(n)} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px' }}>✎</button>
                      <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px', opacity: .6 }}>✕</button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Note Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Note' : 'New Note'}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Note'}</button>
          </>
        }
      >
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Category</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['my', 'trade'] as const).map(c => (
              <button key={c} onClick={() => setNoteCat(c)} style={{
                padding: '5px 14px', borderRadius: 'var(--r)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                background: noteCat === c ? 'var(--ac-d)' : 'var(--bg4)',
                color: noteCat === c ? 'var(--ac2)' : 'var(--txt2)',
                border: '1px solid ' + (noteCat === c ? 'var(--ac)' : 'var(--brd2)'), fontFamily: 'var(--sans)',
              }}>{c === 'my' ? 'My Note' : 'Trade Note'}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Title</label>
          <input className="fi" value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title..." autoFocus />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Content</label>
          <textarea className="fi" value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Write your notes here..." />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Image (optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label className="btn btn-o" style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgChange} />
              📷 Upload Image
            </label>
            {imgPrev && <img src={imgPrev} style={{ height: '40px', borderRadius: '4px', border: '1px solid var(--brd)' }} />}
            {!imgPrev && editing?.img_url && <span style={{ fontSize: '10px', color: 'var(--ac)' }}>✓ Image saved</span>}
          </div>
        </div>
      </Modal>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 'var(--r)', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
