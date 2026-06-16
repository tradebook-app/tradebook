'use client'

import { DateRange, DateRangeFilter } from '@/lib/types'

type Props = {
  title: string
  filter: DateRangeFilter
  onFilterChange: (f: DateRangeFilter) => void
  actions?: React.ReactNode
}

export function Topbar({ title, filter, onFilterChange, actions }: Props) {
  function handleRangeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const range = e.target.value as DateRange
    onFilterChange({ ...filter, range })
  }

  return (
    <div style={{
      height: '48px',
      borderBottom: '1px solid var(--brd)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 18px',
      gap: '10px',
      flexShrink: 0,
    }}>
      {/* Page title */}
      <div style={{ fontSize: '15px', fontWeight: 700, flex: 1 }}>
        {title}
      </div>

      {/* Date range filter */}
      <select
        value={filter.range}
        onChange={handleRangeChange}
        style={{
          background: 'var(--bg4)',
          border: '1px solid var(--brd2)',
          borderRadius: 'var(--r)',
          color: 'var(--txt)',
          fontSize: '11px',
          padding: '5px 9px',
          fontFamily: 'var(--sans)',
          outline: 'none',
          minWidth: '110px',
          cursor: 'pointer',
        }}
      >
        <option value="all">All Dates</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="year">This Year</option>
        <option value="custom">Custom Range</option>
      </select>

      {/* Custom date inputs */}
      {filter.range === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="date"
            value={filter.from || ''}
            onChange={e => onFilterChange({ ...filter, from: e.target.value })}
            style={{
              background: 'var(--bg4)',
              border: '1px solid var(--brd2)',
              borderRadius: 'var(--r)',
              color: 'var(--txt)',
              fontSize: '11px',
              padding: '5px 9px',
              fontFamily: 'var(--sans)',
              outline: 'none',
            }}
          />
          <span style={{ color: 'var(--txt3)', fontSize: '11px' }}>→</span>
          <input
            type="date"
            value={filter.to || ''}
            onChange={e => onFilterChange({ ...filter, to: e.target.value })}
            style={{
              background: 'var(--bg4)',
              border: '1px solid var(--brd2)',
              borderRadius: 'var(--r)',
              color: 'var(--txt)',
              fontSize: '11px',
              padding: '5px 9px',
              fontFamily: 'var(--sans)',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Extra action buttons injected per page */}
      {actions}
    </div>
  )
}
