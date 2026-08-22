'use client'

import { useState, useEffect } from 'react'
import type { Partner, MonthlyBucket } from './types'
import { PartnerStatCards } from '@/components/admin/PartnerStatCards'
import { PartnerTrendChart } from '@/components/admin/PartnerTrendChart'
import { TopPartnersChart } from '@/components/admin/TopPartnersChart'
import { PartnerTable } from '@/components/admin/PartnerTable'

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyBucket[]>([])
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [formMessage, setFormMessage] = useState<string | null>(null)

  function loadPartners() {
    setError(null)
    fetch('/api/referrals/admin/partners')
      .then(async r => {
        if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Failed to load') }
        return r.json()
      })
      .then(json => {
        setPartners(json.partners)
        setMonthlyTrend(json.monthlyTrend || [])
      })
      .catch(err => setError(err.message))
  }

  useEffect(() => { loadPartners() }, [])

  async function createPartner(e: React.FormEvent) {
    e.preventDefault()
    setFormMessage(null)
    const res = await fetch('/api/referrals/admin/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const json = await res.json()
    if (!res.ok) {
      setFormMessage(json.error || 'Failed to create partner')
      return
    }
    setFormMessage(`${email} is now a partner with code "${json.code}".`)
    setEmail('')
    setCode('')
    loadPartners()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D11', color: '#fff', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Affiliate Partners</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
          Partners earn a custom rate for a custom date range, set per-partner below (vs. the standard 20%/6-month friend program).
        </p>

        <form onSubmit={createPartner} style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            placeholder="Partner's account email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ flex: 1, minWidth: '220px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
          />
          <input
            placeholder="vanity-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            style={{ width: '160px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
          />
          <button type="submit" style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>
            Assign partner
          </button>
        </form>
        {formMessage && <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '24px' }}>{formMessage}</div>}

        {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>Error: {error}</div>}

        {!partners ? (
          <div style={{ color: '#888', fontSize: '13px' }}>Loading...</div>
        ) : (
          <>
            <PartnerStatCards partners={partners} />
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
              <PartnerTrendChart monthlyTrend={monthlyTrend} />
              <TopPartnersChart partners={partners} />
            </div>
            <PartnerTable partners={partners} onChanged={loadPartners} />
          </>
        )}
      </div>
    </div>
  )
}
