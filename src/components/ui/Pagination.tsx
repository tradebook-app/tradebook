'use client'
import { useEffect, useRef, useState } from 'react'
import { PAGE_SIZE_OPTIONS, type Pagination as PaginationState } from '@/lib/usePagination'

type Props = {
  pg: PaginationState
  /** plural noun for the count, e.g. "trades", "notes", "symbols" */
  itemLabel?: string
}

/**
 * Footer for a paginated list: "rows per page" picker, a "1–50 of 157" count,
 * and previous / next buttons. Sits below the list; the size dropdown opens
 * upward so it isn't clipped at the bottom of the viewport.
 */
export function Pagination({ pg, itemLabel = 'rows' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const arrow = (dir: 'prev' | 'next') => {
    const enabled = dir === 'prev' ? pg.canPrev : pg.canNext
    return (
      <button
        onClick={dir === 'prev' ? pg.prev : pg.next}
        disabled={!enabled}
        aria-label={dir === 'prev' ? 'Previous page' : 'Next page'}
        style={{
          width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: '7px',
          color: enabled ? 'var(--txt2)' : 'var(--txt3)',
          cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.45,
          transition: '.1s', flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === 'prev' ? 'rotate(90deg)' : 'rotate(-90deg)' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '14px', flexWrap: 'wrap',
      padding: '10px 2px', borderTop: '1px solid var(--brd)',
      fontSize: '11px', color: 'var(--txt3)', fontFamily: 'var(--sans)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{itemLabel === 'rows' ? 'Rows per page' : `${itemLabel[0].toUpperCase()}${itemLabel.slice(1)} per page`}</span>
        <div ref={ref} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--bg4)', border: `1px solid ${open ? 'var(--ac)' : 'var(--brd2)'}`,
              borderRadius: '7px', color: 'var(--txt)', fontSize: '11px', fontWeight: 600,
              padding: '5px 9px', cursor: 'pointer', fontFamily: 'var(--sans)', transition: '.1s',
            }}
          >
            {pg.pageSize}
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'none' : 'rotate(180deg)' }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {open && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
              background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: '10px',
              boxShadow: '0 12px 32px rgba(0,0,0,.4)', overflow: 'hidden', zIndex: 300, padding: '5px', minWidth: '76px',
            }}>
              {PAGE_SIZE_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => { pg.setPageSize(n); setOpen(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px',
                    borderRadius: '7px', border: 'none',
                    background: n === pg.pageSize ? 'var(--ac-d)' : 'transparent',
                    color: n === pg.pageSize ? 'var(--ac2)' : 'var(--txt2)',
                    fontSize: '11px', fontWeight: n === pg.pageSize ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'var(--sans)',
                  }}
                >{n}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--txt2)', whiteSpace: 'nowrap' }}>{pg.rangeLabel}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {arrow('prev')}
          {arrow('next')}
        </div>
      </div>
    </div>
  )
}
