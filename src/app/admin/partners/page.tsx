'use client'

import { useState, useEffect } from 'react'

type Partner = {
  id: string
  name: string
  code: string | null
  rate: number
  months: number
  windowStart: string | null
  windowEnd: string | null
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

// Converts a stored ISO instant to the yyyy-mm-dd shape <input type="date"> expects.
function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [formMessage, setFormMessage] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRate, setEditRate] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

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

  function openEdit(p: Partner, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(p.id)
    setEditRate(String(Math.round(p.rate * 100)))
    setEditStart(toDateInputValue(p.windowStart))
    setEditEnd(toDateInputValue(p.windowEnd))
    setEditError(null)
  }

  function closeEdit(e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditError(null)
    const ratePct = Number(editRate)
    if (!editStart || !editEnd || Number.isNaN(ratePct) || ratePct <= 0 || ratePct > 100) {
      setEditError('Enter a rate between 1-100 and both dates.')
      return
    }
    setEditSaving(true)
    const res = await fetch(`/api/referrals/admin/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commission_rate: ratePct / 100,
        commission_window_start: `${editStart}T00:00:00.000Z`,
        commission_window_end: `${editEnd}T23:59:59.999Z`,
      }),
    })
    const json = await res.json()
    setEditSaving(false)
    if (!res.ok) {
      setEditError(json.error || 'Failed to save changes')
      return
    }
    setEditingId(null)
    loadPartners()
  }

  async function removePartner(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Remove this partner? They revert to standard friend terms (20% for 6 months on future referrals). Their vanity code and past commissions are kept.')) {
      return
    }
    setEditSaving(true)
    const res = await fetch(`/api/referrals/admin/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_partner: false }),
    })
    setEditSaving(false)
    if (!res.ok) {
      const json = await res.json()
      setEditError(json.error || 'Failed to remove partner')
      return
    }
    setEditingId(null)
    if (selected === id) setSelected(null)
    loadPartners()
  }

  const usd = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D11', color: '#fff', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Affiliate Partners</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
          Partners earn a custom rate for a custom date range, set per-partner below (vs. the standard 20%/6-month friend program).
        </p>
        {partners && (
          <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '18px' }}>
            {partners.length} active partner{partners.length === 1 ? '' : 's'}
          </p>
        )}

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
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      {p.signups} signups &middot; {(p.rate * 100).toFixed(0)}%
                      {p.windowStart && p.windowEnd
                        ? ` from ${new Date(p.windowStart).toLocaleDateString()} to ${new Date(p.windowEnd).toLocaleDateString()}`
                        : ' (no window set)'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700 }}>Owed {usd(p.owed)}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>Paid {usd(p.paid)} &middot; Gross {usd(p.grossTotal)}</div>
                    </div>
                    <button
                      onClick={e => openEdit(p, e)}
                      style={{ background: '#1a1a1f', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {editingId === p.id && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ marginTop: '14px', padding: '14px', background: '#0a0a0d', border: '1px solid #222', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>
                        Rate %
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={editRate}
                          onChange={e => setEditRate(e.target.value)}
                          style={{ display: 'block', width: '80px', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                        />
                      </label>
                      <label style={{ fontSize: '11px', color: '#888' }}>
                        Start date
                        <input
                          type="date"
                          value={editStart}
                          onChange={e => setEditStart(e.target.value)}
                          style={{ display: 'block', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                        />
                      </label>
                      <label style={{ fontSize: '11px', color: '#888' }}>
                        End date
                        <input
                          type="date"
                          value={editEnd}
                          onChange={e => setEditEnd(e.target.value)}
                          style={{ display: 'block', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                        />
                      </label>
                    </div>
                    {editError && <div style={{ color: '#ef4444', fontSize: '12px' }}>{editError}</div>}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        disabled={editSaving}
                        onClick={e => saveEdit(p.id, e)}
                        style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Save changes
                      </button>
                      <button
                        onClick={closeEdit}
                        style={{ background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={editSaving}
                        onClick={e => removePartner(p.id, e)}
                        style={{ marginLeft: 'auto', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Remove partner
                      </button>
                    </div>
                  </div>
                )}

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
