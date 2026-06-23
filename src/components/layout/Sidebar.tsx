'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',   icon: '▣',  label: 'Dashboard' },
  { href: '/trades',      icon: '⫐',  label: 'Trade View' },
  { href: '/journal',     icon: '◫',  label: 'Journal' },
  { href: '/notebook',    icon: '☰',  label: 'Notebook' },
  { href: '/reports',     icon: '◩',  label: 'Reports' },
  { href: '/strategies',  icon: '◇',  label: 'Strategies' },
]

const TOOLS = [
  { href: '/position-size', icon: '⊞', label: 'Position Size' },
  { href: '/ai-analysis',   icon: '🤖', label: 'Sleek AI' },
  { href: '/settings',      icon: '⚙', label: 'Settings' },
]

type Props = {
  onAddTrade: () => void
  userEmail?: string
}

export function Sidebar({ onAddTrade, userEmail }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [showMenu, setShowMenu] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const menuRef = useRef<HTMLDivElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [traderTypes, setTraderTypes] = useState<string[]>([])

  const displayName = firstName
    ? `${firstName} ${lastName}`.trim()
    : userEmail?.split('@')[0] || 'Trader'

  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : userEmail ? userEmail.substring(0, 2).toUpperCase() : 'AY'

  const traderLabel = traderTypes.length > 0
    ? traderTypes.slice(0, 2).join(' + ')
    : 'Trader'

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url, trader_types')
        .eq('id', user.id)
        .single()
      if (data) {
        if (data.first_name) setFirstName(data.first_name)
        if (data.last_name) setLastName(data.last_name)
        if (data.avatar_url) setAvatarUrl(data.avatar_url)
        if (data.trader_types) setTraderTypes(data.trader_types)
      }
    }
    loadProfile()
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    const saved = (localStorage.getItem('sleek-theme') as 'dark' | 'light') || 'dark'
    setTheme(saved)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('sleek-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <nav style={{
      width: '175px',
      minHeight: '100vh',
      background: 'var(--bg2)',
      borderRight: '1px solid var(--brd)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '14px', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <svg width="34" height="34" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
            <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
            <rect x="11" y="13" width="42" height="4" rx="2" fill="#5DCAA5"/>
            <rect x="11" y="21" width="42" height="4" rx="2" fill="#5DCAA5" opacity={0.5}/>
            <rect x="11" y="29" width="28" height="4" rx="2" fill="#5DCAA5" opacity={0.22}/>
            <polyline points="11,51 22,39 33,45 51,27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="11" cy="51" r="2.5" fill="#5DCAA5" opacity={0.7}/>
            <circle cx="22" cy="39" r="2.5" fill="#5DCAA5" opacity={0.7}/>
            <circle cx="33" cy="45" r="2.5" fill="#5DCAA5" opacity={0.7}/>
            <circle cx="51" cy="27" r="3.5" fill="#5DCAA5"/>
          </svg>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-.01em' }}>
            Sleek<span style={{ color: '#1D9E75' }}>trade</span>
          </div>
        </Link>
      </div>

      <div ref={menuRef} style={{ position: 'relative', margin: '10px 10px 4px' }}>
        <button
          onClick={() => setShowMenu(v => !v)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '100%', padding: '9px', background: 'var(--ac)', color: '#000', borderRadius: 'var(--r)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'var(--sans)', transition: '.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ac2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--ac)')}
        >
          + Add Trade
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: '2px', transition: '.15s', transform: showMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        {showMenu && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: '10px', overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
            <button
              onClick={() => { setShowMenu(false); onAddTrade() }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--brd)', transition: '.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: '16px' }}>✏️</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt)' }}>Log manually</div>
                <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>Enter trade details</div>
              </div>
            </button>
            <Link
              href="/import"
              onClick={() => setShowMenu(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 14px', textDecoration: 'none', transition: '.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: '16px' }}>⤓</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt)' }}>Import from broker</div>
                <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>DAS, TOS, IBKR & more</div>
              </div>
            </Link>
          </div>
        )}
      </div>

      <div style={{ padding: '4px 0' }}>
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', cursor: 'pointer', color: active ? 'var(--ac2)' : 'var(--txt2)', fontSize: '12px', fontWeight: 500, transition: '.1s', borderLeft: `2px solid ${active ? 'var(--ac)' : 'transparent'}`, background: active ? 'var(--ac-d)' : 'transparent', textDecoration: 'none' }}>
              <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </div>

      <div style={{ height: '1px', background: 'var(--brd)', margin: '5px 12px' }} />

      <div style={{ padding: '4px 0' }}>
        {TOOLS.map(({ href, icon, label }) => {
          const active = pathname === href
          const isAI = href === '/ai-analysis'
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
              cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: '.1s',
              borderLeft: `2px solid ${active ? 'var(--ac)' : 'transparent'}`,
              background: active ? 'var(--ac-d)' : 'transparent',
              textDecoration: 'none',
              color: active ? 'var(--ac2)' : isAI ? '#10B981' : 'var(--txt2)',
            }}>
              <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>{icon}</span>
              {label}
              {isAI && !active && (
                <span style={{ marginLeft: 'auto', fontSize: '8px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '4px', padding: '1px 5px' }}>
                  ELITE
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <div style={{ marginTop: 'auto', padding: '10px 12px', borderTop: '1px solid var(--brd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '26px', height: '26px', background: 'var(--ac)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#000', flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
            <div style={{ fontSize: '8px', color: 'var(--txt3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{traderLabel}</div>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          style={{ width: '100%', padding: '5px 8px', background: 'transparent', border: '1px solid var(--brd2)', borderRadius: 'var(--r)', color: 'var(--txt2)', fontSize: '9px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', textAlign: 'center', transition: '.1s', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brd3)'; e.currentTarget.style.color = 'var(--txt)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd2)'; e.currentTarget.style.color = 'var(--txt2)' }}
        >
          {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
        </button>
        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '5px 8px', background: 'transparent', border: '1px solid var(--brd2)', borderRadius: 'var(--r)', color: 'var(--txt3)', fontSize: '9px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', textAlign: 'center', transition: '.1s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt3)'; e.currentTarget.style.borderColor = 'var(--brd2)' }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
