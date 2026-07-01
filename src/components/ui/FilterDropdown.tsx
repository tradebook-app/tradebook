'use client'

import { useState, useRef, useEffect } from 'react'

type Option = { value: string; label: string }

type Props = {
  value: string
  options: Option[]
  onChange: (value: string) => void
  minWidth?: string
}

export function FilterDropdown({ value, options, onChange, minWidth }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const current = options.find(o => o.value === value)?.label || options[0]?.label || ''

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: open ? 'var(--bg5)' : 'var(--bg4)',
          border: `1px solid ${open ? 'var(--ac)' : 'var(--brd2)'}`,
          borderRadius: '999px',
          color: 'var(--txt)',
          fontSize: '11.5px', fontWeight: 600,
          padding: '0 14px',
          height: '32px',
          boxSizing: 'border-box',
          fontFamily: 'var(--sans)',
          cursor: 'pointer',
          transition: '.12s',
          minWidth,
          whiteSpace: 'nowrap',
        }}
      >
        {current}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: '.15s', transform: open ? 'rotate(180deg)' : 'none', marginLeft: 'auto' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: minWidth || '150px',
          background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: '16px',
          boxShadow: '0 16px 40px rgba(0,0,0,.35)', overflow: 'hidden', zIndex: 300, padding: '6px',
          maxHeight: '280px', overflowY: 'auto',
        }}>
          {options.map(o => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 12px', borderRadius: '11px', border: 'none',
                  background: active ? 'var(--ac-d)' : 'transparent',
                  color: active ? 'var(--ac2)' : 'var(--txt2)',
                  fontSize: '12px', fontWeight: active ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'var(--sans)', transition: '.1s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg4)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
