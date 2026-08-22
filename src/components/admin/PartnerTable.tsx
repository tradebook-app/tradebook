'use client'
import { useState, Fragment } from 'react'
import type { Partner, LedgerRow } from '@/app/admin/partners/types'

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

const usd = (n: number) => `$${Number(n).toFixed(2)}`

type Props = { partners: Partner[]; onChanged: () => void }

export function PartnerTable({ partners, onChanged }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRate, setEditRate] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  function toggleSelected(id: string) {
    const next = id === selected ? null : id
    setSelected(next)
    if (!next) { setLedger(null); return }
    fetch(`/api/referrals/admin/partners/${next}`)
      .then(r => r.json())
      .then(json => setLedger(json.ledger))
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
    setEditSaving(false)
    if (!res.ok) {
      let json: { error?: string } = {}
      try { json = await res.json() } catch { /* non-JSON error response */ }
      setEditError(json.error || 'Failed to save changes')
      return
    }
    setEditingId(null)
    onChanged()
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
      let json: { error?: string } = {}
      try { json = await res.json() } catch { /* non-JSON error response */ }
      setEditError(json.error || 'Failed to remove partner')
      return
    }
    setEditingId(null)
    if (selected === id) { setSelected(null); setLedger(null) }
    onChanged()
  }

  if (partners.length === 0) {
    return <div style={{ color: '#888', fontSize: '13px' }}>No partners yet.</div>
  }

  return (
    <div style={{ border: '1px solid #222', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '640px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #222' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Partner</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Rate</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Date window</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Signups</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Owed</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Paid</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {partners.map(p => (
              <Fragment key={p.id}>
                <tr
                  onClick={() => toggleSelected(p.id)}
                  style={{ borderBottom: '1px solid #222', cursor: 'pointer', background: selected === p.id ? '#15151a' : 'transparent' }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{p.name} — {p.code}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{(p.rate * 100).toFixed(0)}%</td>
                  <td style={{ padding: '12px 16px', color: '#888' }}>
                    {p.windowStart && p.windowEnd
                      ? `${new Date(p.windowStart).toLocaleDateString('en-US', { timeZone: 'UTC' })} – ${new Date(p.windowEnd).toLocaleDateString('en-US', { timeZone: 'UTC' })}`
                      : 'No window set'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{p.signups}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{usd(p.owed)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{usd(p.paid)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={e => openEdit(p, e)}
                      style={{ background: '#1a1a1f', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>

                {editingId === p.id && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '14px 16px', background: '#0a0a0d', borderBottom: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '10px' }}
                      >
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', color: '#888' }}>
                            Rate %
                            <input
                              type="number" min={1} max={100} step={1}
                              value={editRate} onChange={e => setEditRate(e.target.value)}
                              style={{ display: 'block', width: '80px', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                            />
                          </label>
                          <label style={{ fontSize: '11px', color: '#888' }}>
                            Start date
                            <input
                              type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
                              style={{ display: 'block', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                            />
                          </label>
                          <label style={{ fontSize: '11px', color: '#888' }}>
                            End date
                            <input
                              type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                              style={{ display: 'block', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                            />
                          </label>
                        </div>
                        {editError && <div style={{ color: '#ef4444', fontSize: '12px' }}>{editError}</div>}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button disabled={editSaving} onClick={e => saveEdit(p.id, e)} style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                            Save changes
                          </button>
                          <button onClick={closeEdit} style={{ background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                            Cancel
                          </button>
                          <button disabled={editSaving} onClick={e => removePartner(p.id, e)} style={{ marginLeft: 'auto', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                            Remove partner
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {selected === p.id && ledger && (
                  <tr>
                    <td colSpan={7} style={{ padding: '14px 16px', background: '#0a0a0d', borderBottom: '1px solid #222' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
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
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
