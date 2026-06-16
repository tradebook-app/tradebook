'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '0 16px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            letterSpacing: '.02em',
            marginBottom: '6px',
          }}>
            TRADE<span style={{ color: 'var(--ac2)' }}>BOOK</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>
            Your trading journal
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--brd)',
          borderRadius: 'var(--r2)',
          padding: '28px',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>
            Sign in
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{
                display: 'block',
                fontSize: '9px',
                fontWeight: 600,
                color: 'var(--txt3)',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                marginBottom: '5px',
              }}>
                Email
              </label>
              <input
                className="fi"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '9px',
                fontWeight: 600,
                color: 'var(--txt3)',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                marginBottom: '5px',
              }}>
                Password
              </label>
              <input
                className="fi"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--red-d)',
                border: '1px solid rgba(239,68,68,.2)',
                borderRadius: 'var(--r)',
                padding: '8px 12px',
                fontSize: '11px',
                color: 'var(--red)',
                marginBottom: '14px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-p"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--txt3)' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--ac2)', textDecoration: 'none', fontWeight: 600 }}>
            Create one
          </Link>
        </div>
      </div>
    </div>
  )
}
