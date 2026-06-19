'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function BillingPage() {
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [tradeCount, setTradeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => { setPlan(d.plan); setTradeCount(d.tradeCount) })
      .finally(() => setLoading(false))
  }, [])

  async function handleUpgrade() {
    setCheckoutLoading(true)
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
    if (!priceId) {
      alert('Billing not fully configured yet. Please add NEXT_PUBLIC_STRIPE_PRO_PRICE_ID to environment variables.')
      setCheckoutLoading(false)
      return
    }
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else { alert('Error starting checkout'); setCheckoutLoading(false) }
  }

  async function handlePortal() {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else { alert('Error opening billing portal'); setPortalLoading(false) }
  }

  const isPro = plan === 'pro'
  const usagePercent = Math.min((tradeCount / 50) * 100, 100)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '640px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}
          >
            ← Back to app
          </button>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--txt)' }}>Billing</div>
          <div style={{ fontSize: '13px', color: 'var(--txt3)', marginTop: '4px' }}>Manage your Sleektrade subscription</div>
        </div>

        {/* Success / Cancel banners */}
        {success && (
          <div style={{ background: '#0d2e1e', border: '1px solid #1D9E75', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', color: '#1D9E75', fontSize: '14px' }}>
            🎉 You're now on Pro! All limits removed.
          </div>
        )}
        {canceled && (
          <div style={{ background: '#2a1a1a', border: '1px solid #E24B4A', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', color: '#E24B4A', fontSize: '14px' }}>
            Checkout canceled — you're still on the Free plan.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px' }}>Loading...</div>
        ) : (
          <>
            {/* Current Plan */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '4px' }}>Current plan</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--txt)' }}>
                    {isPro ? 'Pro' : 'Free'}
                    <span style={{
                      marginLeft: '10px', fontSize: '12px', fontWeight: 500,
                      background: isPro ? '#0d2e1e' : 'var(--bg3)',
                      color: isPro ? '#1D9E75' : 'var(--txt3)',
                      padding: '3px 10px', borderRadius: '20px',
                    }}>
                      {isPro ? 'ACTIVE' : 'FREE'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--txt)' }}>
                  {isPro ? '$29' : '$0'}<span style={{ fontSize: '13px', color: 'var(--txt3)', fontWeight: 400 }}>/mo</span>
                </div>
              </div>

              {!isPro && (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '8px' }}>
                    Trade usage — {tradeCount} / 50 this month
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: '4px', height: '6px', marginBottom: '16px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${usagePercent}%`, height: '100%', borderRadius: '4px',
                      background: usagePercent >= 90 ? '#E24B4A' : '#1D9E75',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </>
              )}

              {isPro ? (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '10px 20px', color: 'var(--txt)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
                >
                  {portalLoading ? 'Opening...' : 'Manage subscription →'}
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  style={{ background: '#1D9E75', border: 'none', borderRadius: '8px', padding: '11px 24px', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {checkoutLoading ? 'Loading...' : 'Upgrade to Pro — $29/mo'}
                </button>
              )}
            </div>

            {/* Plan comparison */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--brd)' }}>
                <div style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--txt3)', fontWeight: 500 }}>Feature</div>
                <div style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--txt3)', fontWeight: 500, borderLeft: '1px solid var(--brd)', textAlign: 'center' }}>Free</div>
                <div style={{ padding: '14px 18px', fontSize: '13px', color: '#1D9E75', fontWeight: 600, borderLeft: '1px solid var(--brd)', textAlign: 'center' }}>Pro</div>
              </div>
              {[
                ['Trades per month', '50', 'Unlimited'],
                ['All 7 report tabs', '✓', '✓'],
                ['DAS importer', '✓', '✓'],
                ['Position size calc', '✓', '✓'],
                ['Notebook & strategies', '✓', '✓'],
                ['Broker integrations', '—', 'Coming soon'],
                ['Priority support', '—', '✓'],
              ].map(([feature, free, pro], i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: i < 6 ? '1px solid var(--brd)' : 'none' }}>
                  <div style={{ padding: '12px 18px', fontSize: '13px', color: 'var(--txt)' }}>{feature}</div>
                  <div style={{ padding: '12px 18px', fontSize: '13px', color: 'var(--txt3)', borderLeft: '1px solid var(--brd)', textAlign: 'center' }}>{free}</div>
                  <div style={{ padding: '12px 18px', fontSize: '13px', color: pro === '—' ? 'var(--txt3)' : '#1D9E75', borderLeft: '1px solid var(--brd)', textAlign: 'center', fontWeight: pro !== '—' ? 500 : 400 }}>{pro}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
