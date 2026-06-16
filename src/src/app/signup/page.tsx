'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const supabase = createClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '360px', padding: '0 16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
            Check your email
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt2)', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then come back to sign in.
          </div>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              marginTop: '20px',
              color: 'var(--ac2)',
              fontSize: '11px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 16px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '.02em', marginBottom: '6px' }}>
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
            Create account
          </div>

          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{
                display: 'block', fontSize: '9px', fontWeight: 600,
                color: 'var(--txt3)', textTransform: 'uppercase',
                letterSpacing: '.06em', marginBottom: '5px',
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

            <div style={{ marginBottom: '14px' }}>
              <label style={{
                display: 'block', fontSize: '9px', fontWeight: 600,
                color: 'var(--txt3)', textTransform: 'uppercase',
                letterSpacing: '.06em', marginBottom: '5px',
              }}>
                Password
              </label>
              <input
                className="fi"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                autoComplete="new-password"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', fontSize: '9px', fontWeight: 600,
                color: 'var(--txt3)', textTransform: 'uppercase',
                letterSpacing: '.06em', marginBottom: '5px',
              }}>
                Confirm Password
              </label>
              <input
                className="fi"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
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
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--txt3)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--ac2)', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
