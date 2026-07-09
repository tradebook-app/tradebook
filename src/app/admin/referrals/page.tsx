'use client'

import { useState, useEffect } from 'react'

type Payout = {
  referrerId: string
  name: string
  code: string | null
  total: number
  commissionIds: string[]
}

export default function AdminReferralsPage() {
  const [payouts, setPayouts] = useState<Payout[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)

  function load() {
    setError(null)
    fetch('/api/referrals/admin/payouts')
      .then(async r => {
        if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Failed to load') }
        return r.json()
      })
      .then(json => setPayouts(json.payouts))
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [])

  async function markPaid(p: Payout) {
    if (!confirm(`Mark $${p.total.toFixed(2)} as paid to ${p.name}? Only do this after you've actually sent the payment.`)) return
    setMarking(p.referrerId)
    const res = await fetch('/api/referrals/admin/mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionIds: p.commissionIds }),
    })
    setMarking(null)
    if (res.ok) load()
    else alert('Failed to mark as paid.')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D11', color: '#fff', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Referral Payouts</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '28px' }}>
          Amounts shown are past the 30-day hold and ready to pay. Pay these manually (bank transfer, PayPal, etc.), then mark as paid here.
        </p>

        {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>Error: {error}</div>}

        {!payouts ? (
          <div style={{ color: '#888', fontSize: '13px' }}>Loading...</div>
        ) : payouts.length === 0 ? (
          <div style={{ color: '#888', fontSize: '13px' }}>Nothing owed right now.</div>
        ) : (
          <div style={{ border: '1px solid #222', borderRadius: '10px', overflow: 'hidden' }}>
            {payouts.map(p => (
              <div key={p.referrerId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #222' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{p.code ? `Code: ${p.code}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800 }}>${p.total.toFixed(2)}</div>
                  <button
                    onClick={() => markPaid(p)}
                    disabled={marking === p.referrerId}
                    style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '6px', padding: '8px 14px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', opacity: marking === p.referrerId ? 0.6 : 1 }}
                  >
                    {marking === p.referrerId ? 'Marking...' : 'Mark Paid'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
