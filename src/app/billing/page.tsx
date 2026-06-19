'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function BillingContent() {
  const [plan, setPlan] = useState<'free' | 'pro' | 'elite'>('free')
  const [tradeCount, setTradeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<'pro' | 'elite' | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => { setPlan(d.plan || 'free'); setTradeCount(d.tradeCount || 0) })
      .finally(() => setLoading(false))
  }, [])

  async function handleCheckout(tier: 'pro' | 'elite') {
    setCheckoutLoading(tier)
    const priceId = tier === 'pro'
      ? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
      : process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID
    if (!priceId) {
      alert(`${tier} price ID not configured yet.`)
      setCheckoutLoading(null)
      return
    }
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else { alert('Error starting checkout'); setCheckoutLoading(null) }
  }

  async function handlePortal() {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else { alert('Error opening billing portal'); setPortalLoading(false) }
  }

  const isPro = plan === 'pro' || plan === 'elite'
  const isElite = plan === 'elite'
  const usagePercent = Math.min((tradeCount / 50) * 100, 100)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '700px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}>
            ← Back to app
          </button>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Billing</div>
          <div style={{ fontSize: '13px', color: 'var(--txt3)', marginTop: '4px' }}>Manage your Sleektrade subscription</div>
        </div>

        {/* Banners */}
        {success && (
          <div style={{ background: '#0d2e1e', border: '1px solid #1D9E75', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', color: '#1D9E75', fontSize: '14px' }}>
            🎉 You're now on {plan === 'elite' ? 'Elite' : 'Pro'}! All features unlocked.
          </div>
        )}
        {canceled && (
          <div style={{ background: '#2a1a1a', border: '1px solid #E24B4A', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', color: '#E24B4A', fontSize: '14px' }}>
            Checkout canceled — you're still on the {isPro ? 'Pro' : 'Free'} plan.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px' }}>Loading...</div>
        ) : (
          <>
            {/* Current Plan */}
            <div style={{ background: 'var(--bg2)', border: `1px solid ${isPro ? '#1D9E75' : 'var(--brd)'}`, borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '4px' }}>Current plan</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {isElite ? 'Elite' : isPro ? 'Pro' : 'Free'}
                    <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: 500, background: isPro ? '#0d2e1e' : 'var(--bg3)', color: isPro ? '#1D9E75' : 'var(--txt3)', padding: '3px 10px', borderRadius: '20px' }}>
                      {isPro ? 'ACTIVE' : 'FREE TIER'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>
                  {isElite ? '$29' : isPro ? '$19' : '$0'}<span style={{ fontSize: '13px', color: 'var(--txt3)', fontWeight: 400 }}>/mo</span>
                </div>
              </div>

              {!isPro && (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '8px' }}>Trade usage — {tradeCount} / 50 this month</div>
                  <div style={{ background: 'var(--bg3)', borderRadius: '4px', height: '6px', marginBottom: '16px', overflow: 'hidden' }}>
                    <div style={{ width: `${usagePercent}%`, height: '100%', borderRadius: '4px', background: usagePercent >= 90 ? '#E24B4A' : '#1D9E75', transition: 'width 0.3s ease' }} />
                  </div>
                </>
              )}

              {isPro && (
                <button onClick={handlePortal} disabled={portalLoading} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '10px 20px', color: 'var(--txt)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                  {portalLoading ? 'Opening...' : 'Manage subscription →'}
                </button>
              )}
            </div>

            {/* Pricing cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
              {/* Free */}
              <div style={{ background: 'var(--bg2)', border: `2px solid ${!isPro ? '#1D9E75' : 'var(--brd)'}`, borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Free</div>
                <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>$0</div>
                <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '16px' }}>Forever free</div>
                {['50 trades/month', 'Dashboard & Trade View', 'Basic reports', 'Position size calc'].map(f => (
                  <div key={f} style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>✓ {f}</div>
                ))}
                {!isPro && <div style={{ marginTop: '16px', fontSize: '12px', fontWeight: 700, color: '#1D9E75', textAlign: 'center' }}>Current plan</div>}
              </div>

              {/* Pro */}
              <div style={{ background: 'var(--bg2)', border: `2px solid ${isPro && !isElite ? '#1D9E75' : 'var(--brd)'}`, borderRadius: '12px', padding: '20px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', background: '#10B981', color: '#000', fontSize: '9px', fontWeight: 800, padding: '2px 12px', borderRadius: '20px', whiteSpace: 'nowrap' }}>MOST POPULAR</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Pro</div>
                <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>$19</div>
                <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '16px' }}>per month</div>
                {['Unlimited trades', 'All 7 report tabs', 'DAS Trader importer', 'Notebook & Strategies', 'Backup & restore'].map(f => (
                  <div key={f} style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>✓ {f}</div>
                ))}
                {isPro && !isElite ? (
                  <div style={{ marginTop: '16px', fontSize: '12px', fontWeight: 700, color: '#1D9E75', textAlign: 'center' }}>Current plan</div>
                ) : !isPro ? (
                  <button onClick={() => handleCheckout('pro')} disabled={checkoutLoading !== null} style={{ marginTop: '16px', width: '100%', background: '#10B981', border: 'none', borderRadius: '8px', padding: '10px', color: '#000', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    {checkoutLoading === 'pro' ? 'Loading...' : 'Get Started'}
                  </button>
                ) : null}
              </div>

              {/* Elite */}
              <div style={{ background: 'linear-gradient(145deg, #0f1f1a, #0a1a14)', border: `2px solid ${isElite ? '#1D9E75' : 'rgba(16,185,129,.3)'}`, borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Elite</div>
                <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>$29</div>
                <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '16px' }}>per month</div>
                {['Everything in Pro', 'Priority support', 'Early access to features', 'Broker integrations (soon)', 'AI insights (soon)'].map(f => (
                  <div key={f} style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>✓ {f}</div>
                ))}
                {isElite ? (
                  <div style={{ marginTop: '16px', fontSize: '12px', fontWeight: 700, color: '#1D9E75', textAlign: 'center' }}>Current plan</div>
                ) : (
                  <button onClick={() => handleCheckout('elite')} disabled={checkoutLoading !== null} style={{ marginTop: '16px', width: '100%', background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '8px', padding: '10px', color: '#10B981', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    {checkoutLoading === 'elite' ? 'Loading...' : 'Get Started'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>Loading...</div>}>
      <BillingContent />
    </Suspense>
  )
}
