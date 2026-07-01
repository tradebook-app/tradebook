'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Tab = 'profile' | 'security' | 'subscription'

const TRADER_TYPES = ['Day trader', 'Swing trader', 'Futures trader', 'Options trader', 'Crypto trader', 'Forex trader']

export function Settings({ userEmail }: { userEmail?: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('profile')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [traderTypes, setTraderTypes] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [plan, setPlan] = useState<'free' | 'pro' | 'elite'>('free')
  const [tradeCount, setTradeCount] = useState(0)
  const [subLoading, setSubLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const displayEmail = userEmail || ''
  const initials = (firstName && lastName)
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : displayEmail ? displayEmail.substring(0, 2).toUpperCase() : 'AY'

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, bio, avatar_url, trader_types')
        .eq('id', user.id)
        .single()
      if (data) {
        if (data.first_name) setFirstName(data.first_name)
        if (data.last_name) setLastName(data.last_name)
        if (data.bio) setBio(data.bio)
        if (data.avatar_url) setAvatarUrl(data.avatar_url)
        if (data.trader_types) setTraderTypes(data.trader_types)
      }
    }
    loadProfile()
  }, [])

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => { setPlan(d.plan || 'free'); setTradeCount(d.tradeCount || 0) })
      .finally(() => setSubLoading(false))
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return }

    setAvatarUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setAvatarUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    // Save the cache-busted URL to the DB too, not just local state.
    // The file path never changes (upsert overwrites avatar.png), so a
    // browser/CDN will happily cache the plain publicUrl forever unless
    // the stored URL itself carries a fresh timestamp each upload.
    const urlWithBust = `${publicUrl}?t=${Date.now()}`
    setAvatarUrl(urlWithBust)

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlWithBust })
      .eq('id', user.id)

    if (dbError) {
      alert('Photo uploaded but failed to save: ' + dbError.message)
    }

    setAvatarUploading(false)
  }

  async function saveProfile() {
    setProfileSaving(true)
    setProfileError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfileSaving(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        bio,
        trader_types: traderTypes,
      })
      .eq('id', user.id)

    if (error) {
      setProfileError(error.message)
    } else {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
      localStorage.setItem('st_profile', JSON.stringify({ firstName, lastName, bio, traderTypes, avatarUrl }))
      router.refresh()
    }
    setProfileSaving(false)
  }

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
      setNewPw(''); setConfirmPw('')
    }
    setPwLoading(false)
  }

  async function openPortal() {
    setPortalLoading(true)
    // Open a blank window immediately (before async) so Safari doesn't block it as a popup
    const win = window.open('', '_blank')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        if (win) win.location.href = data.url
        else window.location.href = data.url
      } else {
        if (win) win.close()
        alert('Could not open billing portal. Please try again.')
      }
    } catch {
      if (win) win.close()
      alert('Could not open billing portal. Please try again.')
    }
    setPortalLoading(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    color: 'var(--txt3)', textTransform: 'uppercase',
    letterSpacing: '.06em', marginBottom: '5px',
  }

  return (
    <>
      <style>{`
        .settings-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          min-height: 100%;
        }
        .settings-sidebar {
          border-right: 1px solid var(--brd);
          padding: 24px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .settings-content {
          padding: 32px 40px;
          max-width: 640px;
        }
        .settings-name-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        .settings-signout-mobile {
          display: none;
        }
        .avatar-upload-btn {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #10B981;
          border: 2px solid var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 11px;
          color: #000;
          font-weight: 700;
        }
        .avatar-upload-btn:hover { background: #0ea572; }
        @media (max-width: 768px) {
          .settings-layout { grid-template-columns: 1fr; }
          .settings-sidebar {
            border-right: none;
            border-bottom: 1px solid var(--brd);
            padding: 10px 8px;
            flex-direction: row;
            gap: 4px;
            overflow-x: auto;
          }
          .settings-sidebar .settings-section-label { display: none; }
          .settings-sidebar button { white-space: nowrap; flex: 0 0 auto; width: auto !important; }
          .settings-content { padding: 20px 16px; }
          .settings-name-grid { grid-template-columns: 1fr; }
          .settings-signout-mobile { display: block; margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--brd); }
        }
      `}</style>

      <div className="settings-layout">

        {/* SIDEBAR */}
        <div className="settings-sidebar">
          <div className="settings-section-label" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 10px', marginBottom: '8px' }}>User</div>
          {([['profile', '👤', 'Profile'], ['security', '🔒', 'Security'], ['subscription', '💳', 'Subscription']] as const).map(([t, icon, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 14px', borderRadius: 'var(--r)',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              color: tab === t ? 'var(--ac2)' : 'var(--txt2)',
              background: tab === t ? 'var(--ac-d)' : 'transparent',
              border: 'none', fontFamily: 'var(--sans)', width: '100%',
              textAlign: 'left', transition: '.1s',
            }}>
              <span style={{ fontSize: '14px' }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="settings-content">

          {tab === 'profile' && (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Profile</div>
              <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '28px' }}>Your personal details and trading identity.</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
                <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: '#000' }}>
                      {initials}
                    </div>
                  )}
                  <div className="avatar-upload-btn" onClick={() => fileInputRef.current?.click()} title="Change photo">
                    {avatarUploading ? '...' : 'e'}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
                    {firstName ? `${firstName} ${lastName}`.trim() : displayEmail.split('@')[0]}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '6px' }}>{displayEmail}</div>
                  <button onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}
                    style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ac2)', background: 'var(--ac-d)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>
                    {avatarUploading ? 'Uploading...' : 'Change photo'}
                  </button>
                </div>
              </div>

              <div className="settings-name-grid">
                <div>
                  <label style={lbl}>First name</label>
                  <input className="fi" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ahmad" />
                </div>
                <div>
                  <label style={lbl}>Last name</label>
                  <input className="fi" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Yassine" />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={lbl}>Email</label>
                <input className="fi" value={displayEmail} readOnly style={{ color: 'var(--txt3)', cursor: 'not-allowed' }} />
                <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>Email cannot be changed from here.</div>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={lbl}>Short bio</label>
                <textarea className="fi" value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. Day trading NQ futures. 3 years in." style={{ minHeight: '80px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={lbl}>What do you trade?</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {TRADER_TYPES.map(t => {
                    const active = traderTypes.includes(t)
                    return (
                      <button key={t} onClick={() => setTraderTypes(prev => active ? prev.filter(x => x !== t) : [...prev, t])} style={{
                        fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'var(--sans)',
                        background: active ? 'var(--ac)' : 'var(--bg3)', color: active ? '#000' : 'var(--txt2)',
                        border: active ? 'none' : '1px solid var(--brd)', transition: '.12s',
                      }}>{t}</button>
                    )
                  })}
                </div>
              </div>

              {profileError && (
                <div style={{ background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '12px', color: 'var(--red)', marginBottom: '14px' }}>
                  {profileError}
                </div>
              )}

              <button onClick={saveProfile} disabled={profileSaving} className="btn btn-p" style={{ padding: '10px 24px' }}>
                {profileSaving ? 'Saving...' : profileSaved ? 'Saved!' : 'Save changes'}
              </button>

              <div className="settings-signout-mobile">
                <button onClick={handleSignOut} disabled={signingOut}
                  style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
                  {signingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Security</div>
              <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '28px' }}>Change your password and manage account security.</div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '18px' }}>Change password</div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={lbl}>New password</label>
                  <input className="fi" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="password" autoComplete="new-password" />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={lbl}>Confirm new password</label>
                  <input className="fi" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="password" autoComplete="new-password" />
                </div>
                {pwMsg && (
                  <div style={{ background: pwMsg.type === 'success' ? 'var(--ac-d)' : 'var(--red-d)', border: `1px solid ${pwMsg.type === 'success' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}`, borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '12px', color: pwMsg.type === 'success' ? 'var(--ac2)' : 'var(--red)', marginBottom: '14px' }}>
                    {pwMsg.text}
                  </div>
                )}
                <button onClick={changePassword} disabled={pwLoading} className="btn btn-p" style={{ padding: '10px 20px' }}>
                  {pwLoading ? 'Updating...' : 'Update password'}
                </button>
              </div>

              <div className="settings-signout-mobile">
                <button onClick={handleSignOut} disabled={signingOut}
                  style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
                  {signingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          )}

          {tab === 'subscription' && (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Subscription</div>
              <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '28px' }}>Manage your plan and billing.</div>
              {subLoading ? (
                <div style={{ color: 'var(--txt3)', fontSize: '13px' }}>Loading...</div>
              ) : (
                <>
                  <div style={{ background: 'var(--bg2)', border: `1px solid ${plan !== 'free' ? '#10B981' : 'var(--brd)'}`, borderRadius: 'var(--r2)', padding: '24px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Current plan</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: plan !== 'free' ? '#10B981' : 'var(--txt)' }}>
                          {plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Elite'}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: plan !== 'free' ? 'rgba(16,185,129,.1)' : 'var(--bg3)', color: plan !== 'free' ? '#10B981' : 'var(--txt3)', border: `1px solid ${plan !== 'free' ? 'rgba(16,185,129,.2)' : 'var(--brd)'}` }}>
                        {plan !== 'free' ? 'Active' : 'Free tier'}
                      </div>
                    </div>
                    {plan === 'free' && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--txt3)', marginBottom: '6px' }}>
                          <span>Trade usage</span><span>{tradeCount} / 50 trades</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg4)', borderRadius: '3px' }}>
                          <div style={{ width: `${Math.min((tradeCount / 50) * 100, 100)}%`, height: '100%', background: tradeCount >= 50 ? 'var(--red)' : '#10B981', borderRadius: '3px' }} />
                        </div>
                      </div>
                    )}
                    {plan === 'free' ? (
                      <Link href="/billing" style={{ display: 'inline-block', fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '10px 20px', textDecoration: 'none' }}>
                        Upgrade to Pro - $19/mo
                      </Link>
                    ) : (
                      <button onClick={openPortal} disabled={portalLoading} className="btn btn-o" style={{ padding: '10px 20px' }}>
                        {portalLoading ? 'Opening...' : 'Manage billing & invoices'}
                      </button>
                    )}
                  </div>

                  {plan !== 'elite' && (
                    <div style={{ background: 'linear-gradient(145deg, #0f1f1a, #0a1a14)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 'var(--r2)', padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Elite - $29/mo</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Everything in Pro + Sleek AI</div>
                        <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>Unlimited accounts · Priority support · Early access · Broker integrations</div>
                      </div>
                      <Link href="/billing" style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '8px', padding: '9px 18px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        Upgrade to Elite
                      </Link>
                    </div>
                  )}

                  <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>What you get</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 0', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <span>Feature</span>
                    <span style={{ textAlign: 'center' }}>Free</span>
                    <span style={{ textAlign: 'center' }}>Pro</span>
                    <span style={{ textAlign: 'center', color: '#10B981' }}>Elite</span>
                  </div>
                  {[
                    { feature: 'Trades per month',      free: '50',  pro: 'Unlimited', elite: 'Unlimited' },
                    { feature: 'Trading accounts',       free: '1',   pro: '3',         elite: 'Unlimited' },
                    { feature: 'Dashboard & Trade View', free: '✓',  pro: '✓',         elite: '✓' },
                    { feature: 'Reports (7 tabs)',        free: '✗',  pro: '✓',         elite: '✓' },
                    { feature: 'DAS Trader importer',    free: '✗',  pro: '✓',         elite: '✓' },
                    { feature: 'Notebook & Strategies',  free: '✗',  pro: '✓',         elite: '✓' },
                    { feature: 'Backup & restore',       free: '✗',  pro: '✓',         elite: '✓' },
                    { feature: 'Sleek AI analysis',      free: '✗',  pro: '✗',         elite: '✓' },
                    { feature: 'Priority support',       free: '✗',  pro: '✗',         elite: '✓' },
                    { feature: 'Early access',           free: '✗',  pro: '✗',         elite: '✓' },
                  ].map(row => (
                    <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 0', borderBottom: '1px solid var(--brd)', fontSize: '13px' }}>
                      <span style={{ color: 'var(--txt2)' }}>{row.feature}</span>
                      <span style={{ color: row.free === '✓' ? '#10B981' : row.free === '✗' ? 'var(--txt3)' : 'var(--txt)', textAlign: 'center' }}>{row.free}</span>
                      <span style={{ color: row.pro === '✓' || row.pro === 'Unlimited' || row.pro === '3' ? '#10B981' : 'var(--txt3)', textAlign: 'center', fontWeight: 600 }}>{row.pro}</span>
                      <span style={{ color: row.elite === '✓' || row.elite === 'Unlimited' ? '#10B981' : 'var(--txt3)', textAlign: 'center', fontWeight: 600 }}>{row.elite}</span>
                    </div>
                  ))}
                </>
              )}

              <div className="settings-signout-mobile">
                <button onClick={handleSignOut} disabled={signingOut}
                  style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', marginTop: '20px' }}>
                  {signingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
