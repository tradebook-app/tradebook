import Link from 'next/link'

export default function ContactPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--txt)', fontFamily: 'var(--sans)', minHeight: '100vh' }}>

      {/* NAV */}
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
        <Link href="/login" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none' }}>Start for free</Link>
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

        {/* Contact options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' }}>
          <a href="mailto:support@sleektrade.app" style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px',
            padding: '20px 24px', textDecoration: 'none', transition: '.15s',
          }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(16,185,129,.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--txt)', marginBottom: '2px' }}>Email us</div>
              <div style={{ fontSize: '13px', color: 'var(--txt2)' }}>support@sleektrade.app</div>
            </div>
          </a>

          <a href="https://x.com/sleektrade" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px',
            padding: '20px 24px', textDecoration: 'none', transition: '.15s',
          }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(16,185,129,.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#10B981">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--txt)', marginBottom: '2px' }}>X (Twitter)</div>
              <div style={{ fontSize: '13px', color: 'var(--txt2)' }}>@sleektrade</div>
            </div>
          </a>
        </div>

        {/* Response time note */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', padding: '20px 24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)', marginBottom: '6px' }}>⏱ Response time</div>
          <div style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.6 }}>
            I typically respond within a few hours during business days. For urgent issues, email is the fastest way to reach me.
          </div>
        </div>

        <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--brd)', display: 'flex', gap: '20px', fontSize: '12px' }}>
          <Link href="/" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>← Back to home</Link>
          <Link href="/privacy" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Terms & Conditions</Link>
        </div>
      </div>
    </div>
  )
}
