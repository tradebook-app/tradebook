'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',   icon: '▣',  label: 'Dashboard' },
  { href: '/trades',      icon: '⫐',  label: 'Trade View' },
  { href: '/notebook',    icon: '☰',  label: 'Notebook' },
  { href: '/reports',     icon: '◩',  label: 'Reports' },
  { href: '/strategies',  icon: '◇',  label: 'Strategies' },
]

const TOOLS = [
  { href: '/position-size', icon: '⊞', label: 'Position Size' },
  { href: '/settings', icon: '⚙', label: 'Settings' },
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

  const initials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : 'AY'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Read saved theme on mount
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

  // Close menu on outside click
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
      {/* Logo */}
      <div style={{
        padding: '14px',
        borderBottom: '1px solid var(--brd)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
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

      {/* Add Trade Button with dropdown */}
      <div ref={menuRef} style={{ position: 'relative', margin: '10px 10px 4px' }}>
        <button
          onClick={() => setShowMenu(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            width: '100%',
            padding: '9px',
            background: 'var(--ac)',
            color: '#000',
            borderRadius: 'var(--r)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            fontFamily: 'var(--sans)',
            transition: '.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ac2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--ac)')}
        >
          + Add Trade
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: '2px', transition: '.15s', transform: showMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--bg3)',
            border: '1px solid var(--brd2)',
            borderRadius: '10px',
            overflow: 'hidden',
            zIndex: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          }}>
            {/* Manual entry */}
            <button
              onClick={() => { setShowMenu(false); onAddTrade() }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '11px 14px',
                background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
                borderBottom: '1px solid var(--brd)',
                transition: '.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: '16px' }}>✏️</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt)' }}>Log manually</div>
                <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>Enter trade details</div>
              </div>
            </button>

            {/* Import from broker */}
            <Link
              href="/import"
              onClick={() => setShowMenu(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '11px 14px',
                textDecoration: 'none',
                transition: '.1s',
              }}
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

      {/* Main Nav */}
      <div style={{ padding: '4px 0' }}>
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', cursor: 'pointer',
                color: active ? 'var(--ac2)' : 'var(--txt2)',
                fontSize: '12px', fontWeight: 500, transition: '.1s',
                borderLeft: `2px solid ${active ? 'var(--ac)' : 'transparent'}`,
                background: active ? 'var(--ac-d)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--brd)', margin: '5px 12px' }} />

      {/* Tools */}
      <div style={{ padding: '4px 0' }}>
        {TOOLS.map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', cursor: 'pointer',
                color: active ? 'var(--ac2)' : 'var(--txt2)',
                fontSize: '12px', fontWeight: 500, transition: '.1s',
                borderLeft: `2px solid ${active ? 'var(--ac)' : 'transparent'}`,
                background: active ? 'var(--ac-d)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </div>

      {/* Footer — User info + theme toggle + sign out */}
      <div style={{ marginTop: 'auto', padding: '10px 12px', borderTop: '1px solid var(--brd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
          <div style={{
            width: '26px', height: '26px', background: 'var(--ac)',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '9px', fontWeight: 700,
            color: '#000', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--txt)' }}>
              {userEmail?.split('@')[0] || 'Ahmad Yassine'}
            </div>
            <div style={{ fontSize: '8px', color: 'var(--txt3)' }}>Swing + Day Trader</div>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: '100%', padding: '5px 8px', background: 'transparent',
            border: '1px solid var(--brd2)', borderRadius: 'var(--r)',
            color: 'var(--txt2)', fontSize: '9px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--sans)',
            textAlign: 'center', transition: '.1s',
            marginBottom: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brd3)'; e.currentTarget.style.color = 'var(--txt)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd2)'; e.currentTarget.style.color = 'var(--txt2)' }}
        >
          {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
        </button>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '5px 8px', background: 'transparent',
            border: '1px solid var(--brd2)', borderRadius: 'var(--r)',
            color: 'var(--txt3)', fontSize: '9px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--sans)', textAlign: 'center', transition: '.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt3)'; e.currentTarget.style.borderColor = 'var(--brd2)' }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
