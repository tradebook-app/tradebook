'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function SignupForm() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan')
  const billing = searchParams.get('billing')
  const refParam = searchParams.get('ref')

  useEffect(() => {
    if (refParam && typeof window !== 'undefined') {
      localStorage.setItem('referral_code', refParam)
    }
  }, [refParam])

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  function getPaidPlanIntent(): { plan: 'pro' | 'elite'; billing: string } | null {
    const urlPlan = plan === 'pro' || plan === 'elite' ? plan : null
    const storedPlan =
      typeof window !== 'undefined' ? localStorage.getItem('signup_plan') : null
    const resolvedPlan =
      urlPlan ?? (storedPlan === 'pro' || storedPlan === 'elite' ? storedPlan : null)
    if (!resolvedPlan) return null
    const resolvedBilling =
      billing ||
      (typeof window !== 'undefined' ? localStorage.getItem('signup_billing') : null) ||
      'monthly'
    return { plan: resolvedPlan, billing: resolvedBilling }
  }

  function getAuthRedirectUrl(): string {
    const intent = getPaidPlanIntent()
    if (intent) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('signup_plan', intent.plan)
        localStorage.setItem('signup_billing', intent.billing)
      }
      const upgradePath = `/auth/upgrade?plan=${intent.plan}&billing=${intent.billing}`
      return `${window.location.origin}/auth/callback?next=${encodeURIComponent(upgradePath)}`
    }
    return `${window.location.origin}/auth/callback`
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectUrl() },
    })
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)

    const redirectTo = getAuthRedirectUrl()

    const { data: signUpData, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })

    if (error) { setError(error.message); setLoading(false); return }

    fetch('/api/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => {})

    const storedRefCode = typeof window !== 'undefined' ? localStorage.getItem('referral_code') : null
    if (storedRefCode && signUpData.user) {
      fetch('/api/referrals/attribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: signUpData.user.id, code: storedRefCode }),
      }).catch(() => {})
      localStorage.removeItem('referral_code')
    }

    setSuccess(true)
    setLoading(false)
  }

  const paidIntent =
    plan === 'pro' || plan === 'elite'
      ? { plan, billing: billing || 'monthly' }
      : null

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px', padding: '0 16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Check your email</div>
          <div style={{ fontSize: '12px', color: 'var(--txt2)', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account{paidIntent ? ` and complete your ${paidIntent.plan.charAt(0).toUpperCase() + paidIntent.plan.slice(1)} plan setup` : ''}.
          </div>
          <Link href="/login" style={{ display: 'inline-block', marginTop: '20px', color: 'var(--ac2)', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>← Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 16px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
            <svg width="36" height="36" viewBox="0 0 64 64">
              <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
              <rect x="13" y="13" width="42" height="4" rx="2" fill="#5DCAA5"/>
              <rect x="11" y="21" width="42" height="4" rx="2" fill="#5DCAA5" opacity={0.5}/>
              <rect x="11" y="29" width="28" height="4" rx="2" fill="#5DCAA5" opacity={0.22}/>
              <polyline points="11,51 22,33 33,45 51,27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="11" cy="51" r="2.5" fill="#5DCAA5" opacity={0.7}/>
              <circle cx="22" cy="39" r="2.5" fill="#5DCAA5" opacity={0.7}/>
              <circle cx="33" cy="45" r="2.5" fill="#5DCAA5" opacity={0.7}/>
              <circle cx="51" cy="27" r="3.5" fill="#5DCAA5"/>
            </svg>
            <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-.01em' }}>
              Sleek<span style={{ color: '#109E75' }}>trade</span>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>Your trading journal</div>
        </div>

        {paidIntent && (
          <div style={{ textAlign: 'center', marginBottom: '16px', fontSize: '12px', color: '#10B981', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '8px', padding: '8px 16px' }}>
            🎯 You're signing up for the <strong>{paidIntent.plan.charAt(0).toUpperCase() + paidIntent.plan.slice(1)}</strong> plan
            {paidIntent.billing === 'yearly' ? ' (billed yearly)' : ''}
          </div>
        )}

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '28px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Create account</div>

          {/* Google Button */}
          <button
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--txt)', cursor: 'pointer', marginBottom: '16px' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--brd)' }} />
            <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--brd)' }} />
          </div>

          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>Email</label>
              <input className="fi" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>Password</label>
              <input className="fi" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required autoComplete="new-password" />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>Confirm Password</label>
              <input className="fi" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required autoComplete="new-password" />
            </div>

            {error && (
              <div style={{ background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '11px', color: 'var(--red)', marginBottom: '14px' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-p" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--txt3)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--ac2)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
