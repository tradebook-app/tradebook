'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DateRangeFilter } from '@/lib/types'
import { DateRangePicker } from './DateRangePicker'
import { ProfileMenu } from './ProfileMenu'
import { useAccounts } from '@/components/AccountProvider'

function AccountSwitcher() {
  const { accounts, selectedAccountId, setSelectedAccountId, loading } = useAccounts()
  if (loading || accounts.length <= 1) return null // nothing to switch between
  return (
    <select
      className="fi"
      value={selectedAccountId || ''}
      onChange={e => setSelectedAccountId(e.target.value || null)}
      style={{ fontSize: '11px', width: 'auto', minWidth: '130px', padding: '5px 10px', background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: 'var(--r)', color: 'var(--txt)' }}
    >
      <option value="">All Accounts</option>
      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
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
