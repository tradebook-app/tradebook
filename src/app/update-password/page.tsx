'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
useEffect(() => {
  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    supabase.auth.exchangeCodeForSession(code).catch(() => {})
  }
}, [])
  async function handleUpdate(e: React.FormEvent) {
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
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
            <svg width="36" height="36" viewBox="0 0 64 64">
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
            <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-.01em' }}>
              Sleek<span style={{ color: '#1D9E75' }}>trade</span>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>Your trading journal</div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '28px' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>Password updated!</div>
              <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>Redirecting you to your dashboard...</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Set new password</div>
              <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '20px' }}>Choose a strong password for your account.</div>
              <form onSubmit={handleUpdate}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>
                    New Password
                  </label>
                  <input className="fi" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>
                    Confirm Password
                  </label>
                  <input className="fi" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
                </div>
                {error && (
                  <div style={{ background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '11px', color: 'var(--red)', marginBottom: '14px' }}>
                    {error}
                  </div>
                )}
                <button type="submit" className="btn btn-p" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--txt3)' }}>
          <Link href="/login" style={{ color: 'var(--ac2)', textDecoration: 'none', fontWeight: 600 }}>← Back to login</Link>
        </div>
      </div>
    </div>
  )
}
