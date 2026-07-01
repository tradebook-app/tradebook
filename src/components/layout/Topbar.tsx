'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DateRange, DateRangeFilter } from '@/lib/types'

type Props = {
  title: string
  filter: DateRangeFilter
  onFilterChange: (f: DateRangeFilter) => void
  actions?: React.ReactNode
}

function MarketStatus() {
  const [clock, setClock] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const update = () => {
      const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const h = et.getHours(), m = et.getMinutes(), day = et.getDay()
      const isWeekend = day === 0 || day === 6
      const s = isWeekend ? 'Market Closed'
        : h < 4 ? 'Market Closed'
        : (h < 9 || (h === 9 && m < 30)) ? 'Pre-Market'
        : h < 16 ? 'Market Open'
        : 'After Hours'
      setStatus(s)
      const dateStr = et.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      setClock(`${dateStr}, ${et.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ET`)
    }
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [])

  const dotColor = status === 'Market Open' ? 'var(--ac)' : status === 'Pre-Market' ? 'var(--orange)' : 'var(--txt4)'

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', padding:'5px 10px', minWidth:'200px' }}>
      <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:dotColor, flexShrink:0 }}/>
      <div>
        <div style={{ fontSize:'11px', fontWeight:600, color:'var(--txt)', lineHeight:1.3 }}>{status}</div>
        <div style={{ fontSize:'10px', color:'var(--txt3)', lineHeight:1.3 }}>{clock}</div>
      </div>
    </div>
  )
}

export function Topbar({ title, filter, onFilterChange, actions }: Props) {
  const pathname = usePathname()
  const isScanner = pathname === '/scanner'
  // These pages don't apply the date filter to anything they show, so
  // displaying it would be misleading — it looks functional but isn't.
  // Trade View, Reports, and Dashboard DO use it — left untouched.
  const hideFilter = ['/ai-analysis', '/journal', '/notebook', '/strategies', '/position-size', '/settings'].includes(pathname)

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

      {/* Scanner page: show market status. Pages with no date-filtered content: show nothing. Everything else: date filter */}
      {isScanner ? (
        <MarketStatus />
      ) : hideFilter ? null : (
        <>
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
          {filter.range === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="date"
                value={filter.from || ''}
                onChange={e => onFilterChange({ ...filter, from: e.target.value })}
                style={{ background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt)', fontSize:'11px', padding:'5px 9px', fontFamily:'var(--sans)', outline:'none' }}
              />
              <span style={{ color: 'var(--txt3)', fontSize: '11px' }}>→</span>
              <input
                type="date"
                value={filter.to || ''}
                onChange={e => onFilterChange({ ...filter, to: e.target.value })}
                style={{ background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt)', fontSize:'11px', padding:'5px 9px', fontFamily:'var(--sans)', outline:'none' }}
              />
            </div>
          )}
        </>
      )}

      {actions}
    </div>
  )
}
