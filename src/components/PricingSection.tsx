'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function PricingSection() {
  const [yearly, setYearly] = useState(false)

  const proPrice = yearly ? 15 : 19
  const elitePrice = yearly ? 23 : 29

  async function handlePlanClick(plan: 'free' | 'pro' | 'elite') {
    if (plan === 'free') {
      window.location.href = '/signup'
      return
    }
    const billing = yearly ? 'yearly' : 'monthly'
    localStorage.setItem('signup_plan', plan)
    localStorage.setItem('signup_billing', billing)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      window.location.href = `/auth/upgrade?plan=${plan}&billing=${billing}`
    } else {
      window.location.href = `/signup?plan=${plan}&billing=${billing}`
    }
  }

  return (
    <section id="pricing" style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '12px' }}>Simple, honest pricing</h2>
        <p style={{ fontSize: '16px', color: 'var(--txt2)' }}>Start free. Upgrade when you are ready.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '40px' }}>
        <span style={{ fontSize: '13px', color: yearly ? 'var(--txt3)' : 'var(--txt)', fontWeight: 600 }}>Monthly</span>
        <div onClick={() => setYearly(!yearly)} style={{ width: '48px', height: '26px', borderRadius: '13px', cursor: 'pointer', background: yearly ? '#10B981' : 'var(--bg4)', border: '1px solid var(--brd2)', position: 'relative', transition: '.2s' }}>
          <div style={{ position: 'absolute', top: '3px', left: yearly ? '24px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: yearly ? '#000' : 'var(--txt3)', transition: '.2s' }} />
        </div>
        <span style={{ fontSize: '13px', color: yearly ? 'var(--txt)' : 'var(--txt3)', fontWeight: 600 }}>
          Yearly
          <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '10px', padding: '1px 8px' }}>-20%</span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', alignItems: 'stretch' }} className='pricing-grid'>

        {/* Free */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '14px', padding: '28px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Free</div>
          <div style={{ fontSize: '40px', fontWeight: 800, marginBottom: '4px' }}>$0</div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '24px' }}>Forever free</div>
          <div style={{ flex: 1 }}>
            {['Up to 50 trades/month', '1 trading account', 'Dashboard & Trade View', 'Basic reports', 'Position size calculator'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <button onClick={() => handlePlanClick('free')} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '28px', fontSize: '13px', fontWeight: 700, color: 'var(--txt)', background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: '8px', padding: '12px', cursor: 'pointer' }}>
            Get Started
          </button>
        </div>

        {/* Pro */}
        <div style={{ background: 'var(--bg2)', border: '2px solid #10B981', borderRadius: '14px', padding: '28px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: '#10B981', color: '#000', fontSize: '10px', fontWeight: 800, padding: '3px 14px', borderRadius: '20px', whiteSpace: 'nowrap' }}>MOST POPULAR</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Pro</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
            <div style={{ fontSize: '40px', fontWeight: 800 }}>${proPrice}</div>
            {yearly && <div style={{ fontSize: '13px', color: 'var(--txt3)', textDecoration: 'line-through' }}>$19</div>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '24px' }}>{yearly ? 'per month, billed yearly' : 'per month'}</div>
          <div style={{ flex: 1 }}>
            {['Unlimited trades', '3 trading accounts', 'All 7 report tabs', '25+ performance metrics', 'DAS Trader importer', 'Notebook & Strategies'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <button onClick={() => handlePlanClick('pro')} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '28px', fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer' }}>
            Get Started
          </button>
        </div>

        {/* Elite */}
        <div style={{ background: 'linear-gradient(145deg, #0f1f1a, #0a1a14)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '14px', padding: '28px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Elite</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
            <div style={{ fontSize: '40px', fontWeight: 800 }}>${elitePrice}</div>
            {yearly && <div style={{ fontSize: '13px', color: 'var(--txt3)', textDecoration: 'line-through' }}>$29</div>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '24px' }}>{yearly ? 'per month, billed yearly' : 'per month'}</div>
          <div style={{ flex: 1 }}>
            {[
              'Everything in Pro',
              'Unlimited trading accounts',
              'Sleek AI trade analysis',
              'Prop Tracker — track prop firm accounts',
              'Auto-sync with IBKR, Tastytrade & Webull',
              'Priority support',
              'Early access to new features',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <button onClick={() => handlePlanClick('elite')} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '28px', fontSize: '13px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '8px', padding: '12px', cursor: 'pointer' }}>
            Get Started
          </button>
        </div>

      </div>
    </section>
  )
}
