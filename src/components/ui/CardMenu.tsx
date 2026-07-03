'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  onEdit: () => void
  onDelete: () => void
}

export function CardMenu({ onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      // Fixed positioning (not absolute) so the dropdown renders relative to
      // the viewport instead of the card — cards use overflow:hidden to
      // round their thumbnail image corners, which was clipping an absolute
      // dropdown before it could ever show.
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.right - 110 })
    }
    setOpen(v => !v)
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={toggle}
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
        <div
          ref={menuRef}
          style={{
            position: 'fixed', top: `${pos.top}px`, left: `${pos.left}px`, minWidth: '110px',
            background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: '8px',
            boxShadow: '0 8px 20px rgba(0,0,0,.35)', overflow: 'hidden', zIndex: 1000, padding: '4px',
          }}
        >
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
