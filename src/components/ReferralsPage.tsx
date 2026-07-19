'use client'

import { useState, useEffect } from 'react'

export function ReferralsPage() {
  const [data, setData] = useState<{
    code: string
    link: string
    stats: { referredCount: number; pendingAmount: number; availableAmount: number; paidAmount: number }
    commissions: any[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/referrals/me')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  function copyLink() {
    if (!data) return
    navigator.clipboard.writeText(data.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statCard = (label: string, value: string, color?: string) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '16px', flex: 1, minWidth: '140px' }}>
      <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: color || 'var(--txt)' }}>{value}</div>
    </div>
  )

  if (loading) {
    return <div style={{ fontSize: '13px', color: 'var(--txt3)' }}>Loading...</div>
  }

  if (!data) {
    return <div style={{ fontSize: '13px', color: 'var(--red)' }}>Couldn't load referral info. Try refreshing.</div>
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Refer & Earn</div>
      <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '24px' }}>
        Earn 20% of what your referrals pay for their first 6 months. New users get nothing extra yet — ask us about a signup discount if you want one added.
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>Your referral link</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input className="fi" readOnly value={data.link} style={{ flex: 1, minWidth: '240px' }} onClick={e => (e.target as HTMLInputElement).select()} />
          <button className="btn btn-p" onClick={copyLink}>{copied ? 'Copied!' : 'Copy link'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {statCard('Referred signups', String(data.stats.referredCount))}
        {statCard('Pending (30-day hold)', `$${data.stats.pendingAmount.toFixed(2)}`)}
        {statCard('Available for payout', `$${data.stats.availableAmount.toFixed(2)}`, 'var(--ac2)')}
        {statCard('Total paid out', `$${data.stats.paidAmount.toFixed(2)}`)}
      </div>

      {data.commissions.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>Commission history</div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--brd)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--txt3)', fontWeight: 600 }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--txt3)', fontWeight: 600 }}>Payment</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--txt3)', fontWeight: 600 }}>Your commission</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--txt3)', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.commissions.map(c => {
                  const isAvailable = c.status === 'pending' && new Date(c.available_at).getTime() <= Date.now()
                  const label = c.status === 'paid' ? 'Paid' : isAvailable ? 'Available' : 'Pending'
                  const color = c.status === 'paid' ? 'var(--txt3)' : isAvailable ? 'var(--ac2)' : 'var(--orange)'
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--mono)' }}>${Number(c.gross_amount).toFixed(2)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)' }}>${Number(c.commission_amount).toFixed(2)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color }}>{label}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
