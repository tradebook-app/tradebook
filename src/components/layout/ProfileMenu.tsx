'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  userEmail?: string
}

export function ProfileMenu({ userEmail }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showMenu, setShowMenu] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const menuRef = useRef<HTMLDivElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : userEmail ? userEmail.substring(0, 2).toUpperCase() : 'AY'

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', user.id)
        .single()
      if (data) {
        if (data.first_name) setFirstName(data.first_name)
        if (data.last_name) setLastName(data.last_name)
        if (data.avatar_url) setAvatarUrl(data.avatar_url)
      }
    }
    loadProfile()
  }, [pathname])

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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
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
    <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        data-tour="profile"
        onClick={() => setShowMenu(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          background: 'transparent',
          flexShrink: 0,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '30px',
            height: '30px',
            background: 'var(--ac)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 700,
            color: '#000',
          }}>
            {initials}
          </div>
        )}
      </button>

      {showMenu && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          minWidth: '180px',
          background: 'var(--bg3)',
          border: '1px solid var(--brd2)',
          borderRadius: '10px',
          overflow: 'hidden',
          zIndex: 300,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
              padding: '10px 14px', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left', fontSize: '12px',
              fontWeight: 600, color: 'var(--txt2)', fontFamily: 'var(--sans)',
              transition: '.1s', borderBottom: '1px solid var(--brd)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>
              {theme === 'dark' ? '☀' : '☾'}
            </span>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

          <Link
            href="/settings"
            onClick={() => setShowMenu(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
              padding: '10px 14px', textDecoration: 'none', fontSize: '12px',
              fontWeight: 600, color: 'var(--txt2)', transition: '.1s',
              borderBottom: '1px solid var(--brd)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>⚙</span>
            Settings
          </Link>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
              padding: '10px 14px', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left', fontSize: '12px',
              fontWeight: 600, color: 'var(--txt3)', fontFamily: 'var(--sans)',
              transition: '.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg4)'; e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--txt3)' }}
          >
            <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>⏻</span>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
