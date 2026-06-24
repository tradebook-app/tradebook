'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function BillingContent() {
  const [plan, setPlan] = useState<'free' | 'pro' | 'elite'>('free')
  const [tradeCount, setTradeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<'pro' | 'elite' | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')
  const setup = searchParams.get('setup') // from pricing page click

  async function loadPlan() {
    const r = await fetch('/api/subscription')
    const d = await r.json()
    setPlan(d.plan || 'free')
    setTradeCount(d.tradeCount || 0)
    return d.plan || 'free'
  }

  useEffect(() => {
    if (success) {
      async function syncAndLoad() {
        try {
          const syncRes = await fetch('/api/stripe/sync', { method: 'POST' })
          const syncData = await syncRes.json()
          if (syncData.plan && syncData.plan !== 'free') {
            setPlan(syncData.plan)
            setLoading(false)
            return
          }
        } catch (e) {}
        let attempts = 0
        const maxAttempts = 8
        const interval = setInterval(async () => {
          attempts++
          try {
            const syncRes = await fetch('/api/stripe/sync', { method: 'POST' })
            const syncData = await syncRes.json()
            if (syncData.plan && syncData.plan !== 'free') {
              setPlan(syncData.plan)
              clearInterval(interval)
              setLoading(false)
              return
            }
          } catch (e) {}
          const currentPlan = await loadPlan()
          if (currentPlan !== 'free' || attempts >= maxAttempts) {
            clearInterval(interval)
            setLoading(false)
          }
        }, 1500)
      }
      syncAndLoad()
    } else if (setup) {
      // Coming from pricing page — check localStorage for plan intent
      const savedPlan = localStorage.getItem('signup_plan') as 'pro' | 'elite' | null
      const savedBilling = (localStorage.getItem('signup_billing') || 'monthly') as 'monthly' | 'yearly'
      localStorage.removeItem('signup_plan')
      localStorage.removeItem('signup_billing')

      if (savedPlan === 'pro' || savedPlan === 'elite') {
        setBillingCycle(savedBilling)
        loadPlan().then(currentPlan => {
          setLoading(false)
          if (currentPlan === 'free') {
            handleCheckoutDirect(savedPlan, savedBilling)
          }
        })
      } else {
        loadPlan().finally(() => setLoading(false))
      }
    } else {
      loadPlan().finally(() => setLoading(false))
    }
  }, [success, setup])

  async function handleCheckoutDirect(tier: 'pro' | 'elite', cycle: 'monthly' | 'yearly') {
    setCheckoutLoading(tier)
    const isYearly = cycle === 'yearly'
    let priceId: string | undefined
    if (tier === 'pro') {
      priceId = isYearly ? process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID : process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
    } else {
      priceId = isYearly ? process.env.NEXT_PUBLIC_STRIPE_ELITE_YEARLY_PRICE_ID : process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID
    }
    if (!priceId) { alert(`${tier} price ID not configured yet.`); setCheckoutLoading(null); return }
    const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId }) })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else { alert('Error starting checkout'); setCheckoutLoading(null) }
  }

  async function handleCheckout(tier: 'pro' | 'elite') {
    await handleCheckoutDirect(tier, billingCycle)
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
  const isYearly = billingCycle === 'yearly'
  const proPrice = isYearly ? '$190' : '$19'
  const elitePrice = isYearly ? '$290' : '$29'
  const period = isYearly ? 'per year' : 'per month'

  const cardStyle = (active: boolean) => ({
    background: 'var(--bg2)',
    border: `2px solid ${active ? '#1D9E75' : 'var(--brd)'}`,
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
  })

  const CurrentPlanBadge = () => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0d2e1e', border: '1px solid #1D9E75', borderRadius: '8px', padding: '6px 12px', marginTop: '16px', fontSize: '12px', fontWeight: 700, color: '#1D9E75' }}>
      Current plan
    </div>
  )

  // Show redirecting screen while auto-triggering checkout
  if (checkoutLoading && !success && !canceled) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--txt3)' }}>
          <div style={{ fontSize: '28px', marginBottom: '16px' }}>⚡</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--txt)' }}>Taking you to checkout...</div>
          <div style={{ fontSize: '12px' }}>Setting up your {checkoutLoading === 'elite' ? 'Elite' : 'Pro'} plan</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: '700px' }}>

        <div style={{ marginBottom: '32px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--txt3)', fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to app</button>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Billing</div>
          <div style={{ fontSize: '13px', color: 'var(--txt3)', marginTop: '4px' }}>Manage your Sleektrade subscription</div>
        </div>

        {success && (
          <div style={{ background: '#0d2e1e', border: '1px solid #1D9E75', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px' }}>
            You are now on {plan === 'elite' ? 'Elite' : 'Pro'}! All features unlocked.
          </div>
        )}
        {canceled && (
          <div style={{ background: '#2a1a1a', border: '1px solid #E24B4A', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px' }}>
            Checkout canceled - you are still on the {isPro ? 'Pro' : 'Free'} plan.
          </div>
        )}

        {loading && success ? (
          <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>...</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Activating your plan...</div>
            <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>This usually takes a few seconds.</div>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px' }}>Loading...</div>
        ) : (
          <>
            <div style={{ background: 'var(--bg2)', border: `1px solid ${isPro ? '#1D9E75' : 'var(--brd)'}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '4px' }}>Current plan</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isElite ? 'Elite' : isPro ? 'Pro' : 'Free'}
                    <span style={{ fontSize: '11px', fontWeight: 600, background: isPro ? '#0d2e1e' : 'var(--bg3)', color: isPro ? '#1D9E75' : 'var(--txt3)', padding: '2px 8px', borderRadius: '20px' }}>
                      {isPro ? 'ACTIVE' : 'FREE TIER'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>
                    {isElite ? '$29' : isPro ? '$19' : '$0'}
                    <span style={{ fontSize: '13px', color: 'var(--txt3)', fontWeight: 400 }}>/mo</span>
                  </div>
                </div>
              </div>
              {!isPro && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--txt3)', marginBottom: '6px' }}>
                    <span>Trade usage</span><span>{tradeCount}/50</span>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: '4px', height: '6px' }}>
                    <div style={{ width: `${usagePercent}%`, height: '100%', borderRadius: '4px', background: usagePercent >= 100 ? '#E24B4A' : '#1D9E75' }} />
                  </div>
                </div>
              )}
              {isPro && (
                <button onClick={handlePortal} disabled={portalLoading} style={{ marginTop: '16px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', color: 'var(--txt)', fontSize: '13px', padding: '8px 16px', cursor: 'pointer' }}>
                  {portalLoading ? 'Opening...' : 'Manage billing & invoices'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
              <span style={{ fontSize: '13px', color: !isYearly ? 'var(--txt)' : 'var(--txt3)', fontWeight: !isYearly ? 600 : 400 }}>Monthly</span>
              <div onClick={() => setBillingCycle(b => b === 'monthly' ? 'yearly' : 'monthly')} style={{ width: '44px', height: '24px', borderRadius: '12px', background: isYearly ? '#1D9E75' : 'var(--bg3)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: '3px', left: isYearly ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontSize: '13px', color: isYearly ? 'var(--txt)' : 'var(--txt3)', fontWeight: isYearly ? 600 : 400 }}>
                Yearly <span style={{ background: '#0d2e1e', color: '#1D9E75', fontSize: '11px', padding: '1px 6px', borderRadius: '10px', marginLeft: '4px' }}>Save 2 months</span>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>

              <div style={cardStyle(plan === 'free')}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Free</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '2px' }}>$0</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '16px' }}>forever free</div>
                  {['50 trades/month', '1 account', 'Dashboard & Trade View', 'Position size calc'].map(f => (
                    <div key={f} style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>✓ {f}</div>
                  ))}
                </div>
                <div style={{ marginTop: '16px' }}>{plan === 'free' ? <CurrentPlanBadge /> : null}</div>
              </div>

              <div style={{ ...cardStyle(plan === 'pro'), position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', background: '#1D9E75', color: '#000', fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '10px' }}>POPULAR</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Pro</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '2px' }}>{proPrice}</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: isYearly ? '2px' : '16px' }}>{period}</div>
                  {isYearly && <div style={{ fontSize: '11px', color: '#1D9E75', marginBottom: '16px' }}>Save $38 vs monthly</div>}
                  {['Unlimited trades', '3 accounts', 'All 7 report tabs', 'DAS Trader importer', 'Notebook & Strategies'].map(f => (
                    <div key={f} style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>✓ {f}</div>
                  ))}
                </div>
                <div style={{ marginTop: '16px' }}>
                  {plan === 'pro' ? <CurrentPlanBadge /> : plan === 'free' ? (
                    <button onClick={() => handleCheckout('pro')} disabled={checkoutLoading !== null} style={{ width: '100%', background: '#1D9E75', color: '#000', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                      {checkoutLoading === 'pro' ? 'Loading...' : 'Get Started'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div style={{ ...cardStyle(plan === 'elite'), background: 'linear-gradient(145deg, #0f1f1a, #0a1a14)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Elite</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '2px' }}>{elitePrice}</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: isYearly ? '2px' : '16px' }}>{period}</div>
                  {isYearly && <div style={{ fontSize: '11px', color: '#1D9E75', marginBottom: '16px' }}>Save $58 vs monthly</div>}
                  {['Everything in Pro', 'Unlimited accounts', 'Sleek AI trade analysis', 'Priority support', 'Early access'].map(f => (
                    <div key={f} style={{ fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>✓ {f}</div>
                  ))}
                </div>
                <div style={{ marginTop: '16px' }}>
                  {plan === 'elite' ? <CurrentPlanBadge /> : (
                    <button onClick={() => handleCheckout('elite')} disabled={checkoutLoading !== null} style={{ width: '100%', background: '#1D9E75', color: '#000', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                      {checkoutLoading === 'elite' ? 'Loading...' : 'Get Started'}
                    </button>
                  )}
                </div>
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
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--txt3)' }}>Loading...</div></div>}>
      <BillingContent />
    </Suspense>
  )
}
