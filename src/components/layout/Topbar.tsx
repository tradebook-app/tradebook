'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { DateRangeFilter } from '@/lib/types'
import { DateRangePicker } from './DateRangePicker'
import { ProfileMenu } from './ProfileMenu'
import { useAccounts } from '@/components/AccountProvider'

function AccountSwitcher() {
  const { accounts, selectedAccountId, setSelectedAccountId, loading } = useAccounts()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (loading || accounts.length <= 1) return null // nothing to switch between

  const label = selectedAccountId
    ? accounts.find(a => a.id === selectedAccountId)?.name || 'All Accounts'
    : 'All Accounts'

  function select(id: string | null) {
    setSelectedAccountId(id)
    setOpen(false)
  }

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
        }}
      >
        {label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: '.15s', transform: open ? 'rotate(180deg)' : 'none', marginLeft: '2px' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '170px',
          background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: '16px',
          boxShadow: '0 16px 40px rgba(0,0,0,.35)', overflow: 'hidden', zIndex: 300, padding: '6px',
        }}>
          <button
            onClick={() => select(null)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '9px 12px', borderRadius: '11px', border: 'none',
              background: !selectedAccountId ? 'var(--ac-d)' : 'transparent',
              color: !selectedAccountId ? 'var(--ac2)' : 'var(--txt2)',
              fontSize: '12px', fontWeight: !selectedAccountId ? 700 : 500,
              cursor: 'pointer', fontFamily: 'var(--sans)', transition: '.1s',
            }}
            onMouseEnter={e => { if (selectedAccountId) e.currentTarget.style.background = 'var(--bg4)' }}
            onMouseLeave={e => { if (selectedAccountId) e.currentTarget.style.background = 'transparent' }}
          >
            All Accounts
          </button>
          {accounts.map(a => {
            const active = selectedAccountId === a.id
            return (
              <button
                key={a.id}
                onClick={() => select(a.id)}
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
                {a.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
type Props = {
  title: string
  filter: DateRangeFilter
  onFilterChange: (f: DateRangeFilter) => void
  actions?: React.ReactNode
  userEmail?: string
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
export function Topbar({ title, filter, onFilterChange, actions, userEmail }: Props) {
  const pathname = usePathname()
  const isScanner = pathname === '/scanner'
  // Trade View, Reports, Dashboard genuinely use the date filter — Trade View
  // now shows it inline in its own filter row instead, so hide the topbar copy there.
  const hideFilter = ['/ai-analysis', '/journal', '/notebook', '/strategies', '/position-size', '/settings', '/trades'].includes(pathname)
  const showAccountSwitcher = ['/dashboard', '/trades', '/journal', '/reports', '/ai-analysis'].includes(pathname)
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
      {showAccountSwitcher && <AccountSwitcher />}
      {isScanner ? (
        <MarketStatus />
      ) : hideFilter ? null : (
        <DateRangePicker filter={filter} onFilterChange={onFilterChange} />
      )}
      {actions}
      <ProfileMenu userEmail={userEmail} />
    </div>
  )
}
