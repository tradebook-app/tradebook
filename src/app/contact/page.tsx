'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })

      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please email us directly at support@sleektrade.app')
    }

    setLoading(false)
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--txt)', fontFamily: 'var(--sans)', minHeight: '100vh' }}>

      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '60px', borderBottom: '1px solid var(--brd)', background: 'rgba(13,13,17,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <svg width="28" height="28" viewBox="0 0 64 64">
            <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
            <polyline points="11,51 22,39 33,45 51,27" fill="none" stroke="#5DCAA5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-.01em', color: 'var(--txt)' }}>
            Sleek<span style={{ color: '#1D9E75' }}>trade</span>
          </span>
        </Link>
        <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none' }}>Start for free</Link>
      </nav>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '4px 14px', marginBottom: '20px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Contact
          </div>
          <h1 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-.03em', marginBottom: '16px', lineHeight: 1.1 }}>Get in touch</h1>
          <p style={{ fontSize: '16px', color: 'var(--txt2)', lineHeight: 1.7 }}>
            Have a question, found a bug, or just want to say hi? I read every message personally and reply within 24 hours.
          </p>
        </div>

        {success ? (
          <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--txt)', marginBottom: '8px' }}>Message sent!</div>
            <div style={{ fontSize: '14px', color: 'var(--txt2)', lineHeight: 1.6 }}>
              Thanks for reaching out. I'll get back to you within 24 hours.
            </div>
            <button
              onClick={() => { setSuccess(false); setName(''); setEmail(''); setSubject(''); setMessage('') }}
              style={{ marginTop: '24px', background: 'transparent', border: '1px solid var(--brd2)', borderRadius: '8px', padding: '8px 20px', color: 'var(--txt2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--sans)' }}
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Name *</label>
                <input
                  className="fi"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Email *</label>
                <input
                  className="fi"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Subject</label>
              <input
                className="fi"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="What's this about?"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Message *</label>
              <textarea
                className="fi"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell me what's on your mind..."
                required
                style={{ minHeight: '140px', resize: 'vertical' }}
              />
            </div>

            {error && (
              <div style={{ background: 'var(--red-d)', border: '1px solid rgba(239,68,68,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--sans)', opacity: loading ? 0.7 : 1, transition: '.15s' }}
            >
              {loading ? 'Sending...' : 'Send message'}
            </button>

            <p style={{ fontSize: '12px', color: 'var(--txt3)', textAlign: 'center' }}>
              Or email directly: <a href="mailto:support@sleektrade.app" style={{ color: '#10B981', textDecoration: 'none' }}>support@sleektrade.app</a>
            </p>
          </form>
        )}

        <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--brd)', display: 'flex', gap: '20px', fontSize: '12px' }}>
          <Link href="/" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>← Back to home</Link>
          <Link href="/privacy" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Terms & Conditions</Link>
        </div>
      </div>
    </div>
  )
}
