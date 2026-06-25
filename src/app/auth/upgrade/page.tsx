'use client'

import { useEffect } from 'react'

const PRICE_IDS: Record<string, string> = {
  'pro-monthly':   process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID!,
  'pro-yearly':    process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID!,
  'elite-monthly': process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID!,
  'elite-yearly':  process.env.NEXT_PUBLIC_STRIPE_ELITE_YEARLY_PRICE_ID!,
}

export default function UpgradePage() {
  useEffect(() => {
    async function redirectToCheckout() {
      const plan    = localStorage.getItem('signup_plan')
      const billing = localStorage.getItem('signup_billing') || 'monthly'

      // Clear storage
      localStorage.removeItem('signup_plan')
      localStorage.removeItem('signup_billing')

      if (!plan || (plan !== 'pro' && plan !== 'elite')) {
        window.location.href = '/dashboard'
        return
      }

      const key     = `${plan}-${billing}`
      const priceId = PRICE_IDS[key]

      if (!priceId) {
        window.location.href = '/dashboard'
        return
      }

      try {
        const res  = await fetch('/api/stripe/checkout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ priceId }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          window.location.href = '/billing'
        }
      } catch {
        window.location.href = '/billing'
      }
    }

    redirectToCheckout()
  }, [])

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
      <div style={{ fontSize: '13px', color: 'var(--txt3)' }}>You'll be redirected to checkout in a moment.</div>
    </div>
  )
}
