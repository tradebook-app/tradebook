'use client'

import { useState, useRef, useEffect } from 'react'
import { DateRange, DateRangeFilter } from '@/lib/types'

type Props = {
  filter: DateRangeFilter
  onFilterChange: (f: DateRangeFilter) => void
}

const PRESETS: { value: DateRange; label: string }[] = [
  { value: 'all',    label: 'All Dates' },
  { value: 'today',  label: 'Today' },
  { value: 'week',   label: 'This Week' },
  { value: 'month',  label: 'This Month' },
  { value: 'year',   label: 'This Year' },
]

const LABELS: Record<DateRange, string> = {
  all: 'All Dates', today: 'Today', week: 'This Week',
  month: 'This Month', year: 'This Year', custom: 'Custom Range',
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  )
}

export function DateRangePicker({ filter, onFilterChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function selectPreset(range: DateRange) {
    if (range === 'custom') {
      onFilterChange({ ...filter, range })
      return
    }
    onFilterChange({ range })
    setOpen(false)
  }

  const label = filter.range === 'custom' && filter.from && filter.to
    ? `${filter.from} → ${filter.to}`
    : LABELS[filter.range]

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
          padding: '7px 14px',
          fontFamily: 'var(--sans)',
          cursor: 'pointer',
          transition: '.12s',
        }}
      >
        <span style={{ color: 'var(--ac2)', display: 'flex' }}><CalendarIcon /></span>
        {label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: '.15s', transform: open ? 'rotate(180deg)' : 'none', marginLeft: '2px' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '190px',
          background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: '16px',
          boxShadow: '0 16px 40px rgba(0,0,0,.35)', overflow: 'hidden', zIndex: 300, padding: '6px',
        }}>
          {PRESETS.map(p => {
            const active = filter.range === p.value
            return (
              <button
                key={p.value}
                onClick={() => selectPreset(p.value)}
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
                {p.label}
              </button>
            )
          })}

          <div style={{ height: '1px', background: 'var(--brd)', margin: '4px 6px' }} />

          <button
            onClick={() => selectPreset('custom')}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '9px 12px', borderRadius: '11px', border: 'none',
              background: filter.range === 'custom' ? 'var(--ac-d)' : 'transparent',
              color: filter.range === 'custom' ? 'var(--ac2)' : 'var(--txt2)',
              fontSize: '12px', fontWeight: filter.range === 'custom' ? 700 : 500,
              cursor: 'pointer', fontFamily: 'var(--sans)', transition: '.1s',
            }}
            onMouseEnter={e => { if (filter.range !== 'custom') e.currentTarget.style.background = 'var(--bg4)' }}
            onMouseLeave={e => { if (filter.range !== 'custom') e.currentTarget.style.background = 'transparent' }}
          >
            Custom Range
          </button>

          {filter.range === 'custom' && (
            <div style={{ padding: '10px 8px 6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="date"
                value={filter.from || ''}
                onChange={e => onFilterChange({ ...filter, from: e.target.value })}
                style={{
                  background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: '10px',
                  color: 'var(--txt)', fontSize: '11px', padding: '7px 10px', fontFamily: 'var(--sans)', outline: 'none',
                }}
              />
              <div style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: '10px' }}>to</div>
              <input
                type="date"
                value={filter.to || ''}
                onChange={e => onFilterChange({ ...filter, to: e.target.value })}
                style={{
                  background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: '10px',
                  color: 'var(--txt)', fontSize: '11px', padding: '7px 10px', fontFamily: 'var(--sans)', outline: 'none',
                }}
              />
              <button
                onClick={() => setOpen(false)}
                className="btn btn-p"
                style={{ marginTop: '4px', borderRadius: '10px' }}
              >Apply</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
