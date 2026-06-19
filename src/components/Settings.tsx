'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Tab = 'profile' | 'security' | 'subscription'

const TRADER_TYPES = ['Day trader', 'Swing trader', 'Futures trader', 'Options trader', 'Crypto trader', 'Forex trader']

export function Settings({ userEmail }: { userEmail?: string }) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('profile')

  // Profile state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [traderTypes, setTraderTypes] = useState<string[]>([])
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Security state
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Subscription state
  const [plan, setPlan] = useState<'free' | 'pro' | 'elite'>('free')
  const [tradeCount, setTradeCount] = useState(0)
  const [subLoading, setSubLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  const initials = userEmail ? userEmail.substring(0, 2).toUpperCase() : 'AY'
  const displayEmail = userEmail || ''

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => { setPlan(d.plan || 'free'); setTradeCount(d.tradeCount || 0) })
      .finally(() => setSubLoading(false))
  }, [])

  async function saveProfile() {
    setProfileSaving(true)
    // Store in localStorage for now (can be extended to Supabase profile table)
    localStorage.setItem('st_profile', JSON.stringify({ firstName, lastName, bio, traderTypes }))
    await new Promise(r => setTimeout(r, 600))
    setProfileSaving(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('st_profile') || '{}')
      if (saved.firstName) setFirstName(saved.firstName)
      if (saved.lastName) setLastName(saved.lastName)
      if (saved.bio) setBio(saved.bio)
      if (saved.traderTypes) setTraderTypes(saved.traderTypes)
    } catch {}
  }, [])

  async function changePassword() {
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return }
    if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return }
    setPwLoading(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'success', text: 'Password updated successfully!' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setPwLoading(false)
  }

  async function openPortal() {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else { alert('Could not open billing portal.'); setPortalLoading(false) }
  }

  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    color: 'var(--txt3)', textTransform: 'uppercase',
    letterSpacing: '.06em', marginBottom: '5px',
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '9px 14px', borderRadius: 'var(--r)',
    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
    color: tab === t ? 'var(--ac2)' : 'var(--txt2)',
    background: tab === t ? 'var(--ac-d)' : 'transparent',
    border: 'none', fontFamily: 'var(--sans)', width: '100%',
    textAlign: 'left', transition: '.1s',
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '0', minHeight: '100%' }}>

      {/* LEFT SIDEBAR */}
      <div style={{ borderRight: '1px solid var(--brd)', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 10px', marginBottom: '8px' }}>User</div>
        {([['profile', '👤', 'Profile'], ['security', '🔒', 'Security'], ['subscription', '💳', 'Subscription']] as const).map(([t, icon, label]) => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            <span style={{ fontSize: '14px' }}>{icon}</span>
            {label}
          </button>
        ))}

      </div>

      {/* RIGHT CONTENT */}
      <div style={{ padding: '32px 40px', maxWidth: '640px' }}>

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Profile</div>
            <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '28px' }}>Your personal details and trading identity.</div>

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--ac)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: '#000', flexShrink: 0,
              }}>{initials}</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{firstName || displayEmail.split('@')[0]}</div>
                <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>{displayEmail}</div>
              </div>
            </div>

            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={lbl}>First name</label>
                <input className="fi" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ahmad" />
              </div>
              <div>
                <label style={lbl}>Last name</label>
                <input className="fi" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Yassine" />
              </div>
            </div>

            {/* Email (read only) */}
            <div style={{ marginBottom: '14px' }}>
              <label style={lbl}>Email</label>
              <input className="fi" value={displayEmail} readOnly style={{ color: 'var(--txt3)', cursor: 'not-allowed' }} />
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>Email cannot be changed from here.</div>
            </div>

            {/* Bio */}
            <div style={{ marginBottom: '18px' }}>
              <label style={lbl}>Short bio</label>
              <textarea
                className="fi"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="e.g. Day trading NQ futures. 3 years in. Working on discipline."
                style={{ minHeight: '80px', resize: 'vertical' }}
              />
            </div>

            {/* What do you trade */}
            <div style={{ marginBottom: '24px' }}>
              <label style={lbl}>What do you trade?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {TRADER_TYPES.map(t => {
                  const active = traderTypes.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => setTraderTypes(prev => active ? prev.filter(x => x !== t) : [...prev, t])}
                      style={{
                        fontSize: '12px', fontWeight: 600, padding: '6px 14px',
                        borderRadius: '20px', cursor: 'pointer', fontFamily: 'var(--sans)',
                        background: active ? 'var(--ac)' : 'var(--bg3)',
                        color: active ? '#000' : 'var(--txt2)',
                        border: active ? 'none' : '1px solid var(--brd)',
                        transition: '.12s',
                      }}
                    >{t}</button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={profileSaving}
              className="btn btn-p"
              style={{ padding: '10px 24px' }}
            >
              {profileSaving ? 'Saving...' : profileSaved ? '✓ Saved!' : 'Save changes'}
            </button>
          </div>
        )}

        {/* SECURITY TAB */}
        {tab === 'security' && (
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Security</div>
            <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '28px' }}>Change your password and manage account security.</div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '24px', maxWidth: '420px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '18px' }}>Change password</div>

              <div style={{ marginBottom: '12px' }}>
                <label style={lbl}>New password</label>
                <input className="fi" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={lbl}>Confirm new password</label>
                <input className="fi" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </div>

              {pwMsg && (
                <div style={{
                  background: pwMsg.type === 'success' ? 'var(--ac-d)' : 'var(--red-d)',
                  border: `1px solid ${pwMsg.type === 'success' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}`,
                  borderRadius: 'var(--r)', padding: '8px 12px',
                  fontSize: '12px', color: pwMsg.type === 'success' ? 'var(--ac2)' : 'var(--red)',
                  marginBottom: '14px',
                }}>
                  {pwMsg.text}
                </div>
              )}

              <button onClick={changePassword} disabled={pwLoading} className="btn btn-p" style={{ padding: '10px 20px' }}>
                {pwLoading ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        )}

        {/* SUBSCRIPTION TAB */}
        {tab === 'subscription' && (
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Subscription</div>
            <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '28px' }}>Manage your plan and billing.</div>

            {subLoading ? (
              <div style={{ color: 'var(--txt3)', fontSize: '13px' }}>Loading...</div>
            ) : (
              <>
                {/* Current plan card */}
                <div style={{ background: 'var(--bg2)', border: `1px solid ${plan !== 'free' ? '#10B981' : 'var(--brd)'}`, borderRadius: 'var(--r2)', padding: '24px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Current plan</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: plan !== 'free' ? '#10B981' : 'var(--txt)' }}>
                        {plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Elite'}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '12px', fontWeight: 700, padding: '4px 12px',
                      borderRadius: '20px', background: plan !== 'free' ? 'rgba(16,185,129,.1)' : 'var(--bg3)',
                      color: plan !== 'free' ? '#10B981' : 'var(--txt3)',
                      border: `1px solid ${plan !== 'free' ? 'rgba(16,185,129,.2)' : 'var(--brd)'}`,
                    }}>
                      {plan !== 'free' ? 'Active' : 'Free tier'}
                    </div>
                  </div>

                  {plan === 'free' && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--txt3)', marginBottom: '6px' }}>
                        <span>Trade usage</span>
                        <span>{tradeCount} / 50 trades</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg4)', borderRadius: '3px' }}>
                        <div style={{ width: `${Math.min((tradeCount / 50) * 100, 100)}%`, height: '100%', background: tradeCount >= 50 ? 'var(--red)' : '#10B981', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {plan === 'free' ? (
                    <Link href="/billing" style={{ display: 'inline-block', fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '10px 20px', textDecoration: 'none' }}>
                      Upgrade to Pro — $19/mo
                    </Link>
                  ) : (
                    <button onClick={openPortal} disabled={portalLoading} className="btn btn-o" style={{ padding: '10px 20px' }}>
                      {portalLoading ? 'Opening...' : 'Manage billing & invoices'}
                    </button>
                  )}
                </div>

                {/* Elite upsell — show when on Free or Pro */}
                {plan !== 'elite' && (
                  <div style={{
                    background: 'linear-gradient(145deg, #0f1f1a, #0a1a14)',
                    border: '1px solid rgba(16,185,129,.25)',
                    borderRadius: 'var(--r2)', padding: '20px', marginBottom: '20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Elite — $29/mo</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Everything in Pro + priority support</div>
                      <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>Early access · Broker integrations · AI insights (coming soon)</div>
                    </div>
                    <Link href="/billing" style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '8px', padding: '9px 18px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      Upgrade to Elite →
                    </Link>
                  </div>
                )}

                {/* Plan comparison */}
                <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>What you get</div>
                {[
                  { feature: 'Trades per month', free: '50', pro: 'Unlimited' },
                  { feature: 'Dashboard & Trade View', free: '✓', pro: '✓' },
                  { feature: 'Reports (7 tabs)', free: '✗', pro: '✓' },
                  { feature: 'DAS Trader importer', free: '✗', pro: '✓' },
                  { feature: 'Notebook & Strategies', free: '✗', pro: '✓' },
                  { feature: 'Backup & restore', free: '✗', pro: '✓' },
                ].map(row => (
                  <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 0', borderBottom: '1px solid var(--brd)', fontSize: '13px' }}>
                    <span style={{ color: 'var(--txt2)' }}>{row.feature}</span>
                    <span style={{ color: row.free === '✓' ? '#10B981' : row.free === '✗' ? 'var(--txt3)' : 'var(--txt)', textAlign: 'center' }}>{row.free}</span>
                    <span style={{ color: '#10B981', textAlign: 'center', fontWeight: 600 }}>{row.pro}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
