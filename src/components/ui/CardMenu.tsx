'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  onEdit: () => void
  onDelete: () => void
}

export function CardMenu({ onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Card options"
        style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: open ? 'var(--bg5)' : 'var(--bg4)',
          border: 'none', color: 'var(--txt3)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', lineHeight: 1, transition: '.1s',
        }}
      >
        ⋮
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: '110px',
          background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: '8px',
          boxShadow: '0 8px 20px rgba(0,0,0,.35)', overflow: 'hidden', zIndex: 20, padding: '4px',
        }}>
          <button
            onClick={() => { setOpen(false); onEdit() }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'none',
              color: 'var(--txt2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--sans)', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg5)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            ✎ Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete() }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'none',
              color: 'var(--red)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--sans)', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--red-d)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  )
}
