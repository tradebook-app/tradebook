'use client'

import { useState, useEffect } from 'react'
import { AdminNav } from '@/components/admin/AdminNav'

type RecentSignup = {
  email: string | null
  plan: string
  created_at: string
}

type UserStats = {
  totalUsers: number
  planCounts: { free: number; pro: number; elite: number }
  recentSignups: RecentSignup[]
  signups7d: number
  signups30d: number
}

function planLabel(plan: string): string {
  return plan === 'pro' ? 'Pro' : plan === 'elite' ? 'Elite' : 'Free'
}

const statCard = (label: string, value: string | number) => (
  <div key={label} style={{ background: '#15151a', border: '1px solid #222', borderRadius: '10px', padding: '16px', flex: 1, minWidth: '160px' }}>
    <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{value}</div>
  </div>
)

export default function AdminUsersPage() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    fetch('/api/admin/users')
      .then(async r => {
        if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Failed to load') }
        return r.json()
      })
      .then(json => setStats(json))
      .catch(err => setError(err.message))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D11', color: '#fff', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <AdminNav active="users" />

        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Users</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '28px' }}>
          Read-only signup and plan overview.
        </p>

        {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>Error: {error}</div>}

        {!stats ? (
          <div style={{ color: '#888', fontSize: '13px' }}>Loading...</div>
        ) : (
          <>
            {/* Total, top and center */}
            <div style={{ background: '#15151a', border: '1px solid #222', borderRadius: '10px', padding: '24px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total users</div>
              <div style={{ fontSize: '40px', fontWeight: 800, color: '#fff' }}>{stats.totalUsers}</div>
            </div>

            {/* Plan breakdown */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {statCard('Free', stats.planCounts.free)}
              {statCard('Pro', stats.planCounts.pro)}
              {statCard('Elite', stats.planCounts.elite)}
            </div>

            {/* Signup trend */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
              {statCard('Signups, last 7 days', stats.signups7d)}
              {statCard('Signups, last 30 days', stats.signups30d)}
            </div>

            {/* Recent signups */}
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
              Recent signups
              <span style={{ fontWeight: 400, color: '#888', marginLeft: '8px' }}>
                (newest first, up to {stats.recentSignups.length})
              </span>
            </div>

            {stats.recentSignups.length === 0 ? (
              <div style={{ color: '#888', fontSize: '13px' }}>No signups yet.</div>
            ) : (
              <div style={{ border: '1px solid #222', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '480px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #222' }}>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Email</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Plan</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Signed up</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentSignups.map((u, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.email || '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#888' }}>{planLabel(u.plan)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#888' }}>
                            {new Date(u.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
