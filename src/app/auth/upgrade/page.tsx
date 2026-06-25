'use client'

import { useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function UpgradeRedirect() {
  const searchParams = useSearchParams()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function redirectToCheckout() {
      const urlPlan = searchParams.get('plan')
      const urlBilling = searchParams.get('billing')

      const plan =
        urlPlan === 'pro' || urlPlan === 'elite'
          ? urlPlan
          : localStorage.getItem('signup_plan')
      const billing =
        urlBilling || localStorage.getItem('signup_billing') || 'monthly'

      if (!plan || (plan !== 'pro' && plan !== 'elite')) {
        window.location.href = '/dashboard'
        return
      }

      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: plan, cycle: billing }),
        })
        const data = await res.json()
        if (data.url) {
          localStorage.removeItem('signup_plan')
          localStorage.removeItem('signup_billing')
          window.location.href = data.url
        } else {
          window.location.href = '/billing'
        }
      } catch {
        window.location.href = '/billing'
      }
    }

    redirectToCheckout()
  }, [searchParams])

  return (
    <div style={{
      minHeight:      '100vh',
      background:     'var(--bg)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexDirection:  'column',
      gap:            '16px',
    }}>
      <div style={{ fontSize: '24px' }}>⚡</div>
      <div style={{ fontSize: '16px', fontWeight: 700 }}>Setting up your plan...</div>
      <div style={{ fontSize: '13px', color: 'var(--txt3)' }}>You&apos;ll be redirected to checkout in a moment.</div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradeRedirect />
    </Suspense>
  )
}
