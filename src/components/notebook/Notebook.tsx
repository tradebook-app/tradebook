'use client'

import { useState, useEffect } from 'react'
import type { NoteRow } from '@/lib/types'
import {
  fetchNotes, insertNote, updateNote, deleteNote,
  uploadNoteImage, getNoteImageUrl,
} from '@/lib/noteService'
import { Modal } from '@/components/ui/Modal'

type Props = { userId: string }
type Cat   = 'all' | 'trade' | 'my'

export function Notebook({ userId }: Props) {
  const [notes,    setNotes]    = useState<NoteRow[]>([])
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

  // Image URLs cache
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchNotes().then(data => { setNotes(data); setLoading(false) })
  }, [])

  // Load signed URLs for notes with images
  useEffect(() => {
    notes.forEach(n => {
      if (n.img_url && !imgUrls[n.img_url]) {
        getNoteImageUrl(n.img_url).then(url => {
          if (url) setImgUrls(prev => ({ ...prev, [n.img_url!]: url }))
        })
      }
    })
  }, [notes])

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

    setSaving(false)
    setModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return
    const ok = await deleteNote(id)
    if (ok) setNotes(prev => prev.filter(n => n.id !== id))
  }

  const filtered = notes
    .filter(n => cat === 'all' || n.category === cat)
    .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase()))

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all', 'trade', 'my'] as Cat[]).map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              padding: '5px 14px', borderRadius: 'var(--r)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              background: cat === c ? 'var(--ac)' : 'var(--bg4)',
              color: cat === c ? '#000' : 'var(--txt2)',
              border: '1px solid ' + (cat === c ? 'var(--ac)' : 'var(--brd2)'),
              fontFamily: 'var(--sans)',
            }}
          >
            {c === 'all' ? 'All Notes' : c === 'trade' ? 'Trade Notes' : 'My Notes'}
          </button>
        ))}
        <input
          className="fi"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notes..."
          style={{ width: '180px', marginLeft: '4px' }}
        />
        <button className="btn btn-p" onClick={openNew} style={{ marginLeft: 'auto' }}>
          + New Note
        </button>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px', fontSize: '12px' }}>
          No notes yet. Click "+ New Note" to start your trading journal.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {filtered.map(n => {
            const imgUrl = n.img_url ? imgUrls[n.img_url] : null
            return (
              <div
                key={n.id}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--brd)',
                  borderRadius: 'var(--r2)', overflow: 'hidden',
                  transition: '.15s', cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brd3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brd)')}
              >
                {/* Image */}
                {imgUrl && (
                  <div
                    style={{ height: '140px', overflow: 'hidden', background: 'var(--bg4)' }}
                    onClick={() => setLightbox(imgUrl)}
                  >
                    <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                {/* Content */}
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, flex: 1, marginRight: '8px' }}>{n.title}</div>
                    <span style={{
                      fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', flexShrink: 0,
                      background: n.category === 'trade' ? 'var(--blue-d)' : 'var(--bg5)',
                      color: n.category === 'trade' ? 'var(--blue)' : 'var(--txt3)',
                    }}>
                      {n.category === 'trade' ? 'TRADE' : 'MY NOTE'}
                    </span>
                  </div>
                  {n.body && (
                    <div style={{
                      fontSize: '11px', color: 'var(--txt2)', lineHeight: 1.6,
                      display: '-webkit-box', WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      marginBottom: '10px',
                    }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '9px', color: 'var(--txt4)' }}>{fmtDate(n.created_at)}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => openEdit(n)}
                        style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px' }}
                      >✎</button>
                      <button
                        onClick={() => handleDelete(n.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px', opacity: .6 }}
                      >✕</button>
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
            <button className="btn btn-p" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Category</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['my', 'trade'] as const).map(c => (
              <button
                key={c}
                onClick={() => setNoteCat(c)}
                style={{
                  padding: '5px 14px', borderRadius: 'var(--r)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  background: noteCat === c ? 'var(--ac-d)' : 'var(--bg4)',
                  color: noteCat === c ? 'var(--ac2)' : 'var(--txt2)',
                  border: '1px solid ' + (noteCat === c ? 'var(--ac)' : 'var(--brd2)'),
                  fontFamily: 'var(--sans)',
                }}
              >
                {c === 'my' ? 'My Note' : 'Trade Note'}
              </button>
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
