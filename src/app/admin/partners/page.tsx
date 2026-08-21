'use client'

import { useState, useEffect } from 'react'

type Partner = {
  id: string
  name: string
  code: string | null
  rate: number
  months: number
  signups: number
  grossTotal: number
  commissionTotal: number
  owed: number
  paid: number
}

type LedgerRow = {
  id: string
  stripe_invoice_id: string
  gross_amount: number
  commission_amount: number
  status: string
  program: string
  reversal_of: string | null
  available_at: string
  paid_at: string | null
  created_at: string
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
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
      .then(json => setPartners(json.partners))
      .catch(err => setError(err.message))
  }

  useEffect(() => { loadPartners() }, [])

  useEffect(() => {
    if (!selected) { setLedger(null); return }
    fetch(`/api/referrals/admin/partners/${selected}`)
      .then(r => r.json())
      .then(json => setLedger(json.ledger))
  }, [selected])

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

  const usd = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D11', color: '#fff', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Affiliate Partners</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '28px' }}>
          Partners earn 20% for 12 months (vs. the standard 6-month friend program). Assign a vanity code below, then track owed/paid per partner.
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
        ) : partners.length === 0 ? (
          <div style={{ color: '#888', fontSize: '13px' }}>No partners yet.</div>
        ) : (
          <div style={{ border: '1px solid #222', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
            {partners.map(p => (
              <div
                key={p.id}
                onClick={() => setSelected(p.id === selected ? null : p.id)}
                style={{ padding: '16px 20px', borderBottom: '1px solid #222', cursor: 'pointer', background: selected === p.id ? '#15151a' : 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.name} — {p.code}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{p.signups} signups &middot; {(p.rate * 100).toFixed(0)}% for {p.months}mo</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>Owed {usd(p.owed)}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Paid {usd(p.paid)} &middot; Gross {usd(p.grossTotal)}</div>
                  </div>
                </div>
                {selected === p.id && ledger && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #222' }}>
                        <th style={{ textAlign: 'left', padding: '8px', color: '#888' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '8px', color: '#888' }}>Program</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Gross</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Commission</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                          <td style={{ padding: '8px' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '8px' }}>{row.program}{row.reversal_of ? ' (refund)' : ''}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{usd(row.gross_amount)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{usd(row.commission_amount)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
