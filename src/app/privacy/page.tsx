import Link from 'next/link'

export default function PrivacyPage() {
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
        <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none' }}>Start for free</Link>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '4px 14px', marginBottom: '20px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Legal
          </div>
          <h1 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-.03em', marginBottom: '12px', lineHeight: 1.1 }}>Privacy Policy</h1>
          <p style={{ fontSize: '13px', color: 'var(--txt3)' }}>Last updated: June 2026</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px', fontSize: '14px', color: 'var(--txt2)', lineHeight: 1.8 }}>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>1. Who we are</h2>
            <p>Sleektrade ("we", "us", "our") is a professional trading journal platform operated by Ahmad Yassine. Our website is sleektrade.app. If you have any questions about this policy, contact us at support@sleektrade.app.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>2. What data we collect</h2>
            <p style={{ marginBottom: '10px' }}>We collect the following information when you use Sleektrade:</p>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong style={{ color: 'var(--txt)' }}>Account data:</strong> Your email address and password (encrypted) when you create an account.</li>
              <li><strong style={{ color: 'var(--txt)' }}>Trade data:</strong> Trade records you manually enter or import from your broker (symbols, prices, dates, P&L, notes).</li>
              <li><strong style={{ color: 'var(--txt)' }}>Usage data:</strong> Basic analytics about how you use the app (pages visited, features used) to help us improve the product.</li>
              <li><strong style={{ color: 'var(--txt)' }}>Payment data:</strong> Billing information is processed by Stripe. We never store your card details.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>3. How we use your data</h2>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>To provide and operate the Sleektrade service</li>
              <li>To send you account-related emails (confirmation, password reset, welcome email)</li>
              <li>To process payments and manage your subscription</li>
              <li>To improve and develop the product</li>
              <li>To respond to your support requests</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>4. Data sharing</h2>
            <p style={{ marginBottom: '10px' }}>We do not sell your personal data. We share data only with the following trusted services required to operate Sleektrade:</p>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong style={{ color: 'var(--txt)' }}>Supabase</strong> — database and authentication</li>
              <li><strong style={{ color: 'var(--txt)' }}>Stripe</strong> — payment processing</li>
              <li><strong style={{ color: 'var(--txt)' }}>Resend</strong> — transactional emails</li>
              <li><strong style={{ color: 'var(--txt)' }}>Vercel</strong> — hosting and deployment</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>5. Data security</h2>
            <p>We take data security seriously. All data is encrypted in transit (HTTPS) and at rest. Passwords are hashed and never stored in plain text. We use industry-standard security practices through our infrastructure providers.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>6. Your rights</h2>
            <p style={{ marginBottom: '10px' }}>You have the right to:</p>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and all associated data</li>
              <li>Export your trade data at any time</li>
            </ul>
            <p style={{ marginTop: '10px' }}>To exercise any of these rights, email us at support@sleektrade.app.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>7. Cookies</h2>
            <p>We use only essential cookies required for authentication and session management. We do not use advertising or tracking cookies.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>8. Changes to this policy</h2>
            <p>We may update this policy from time to time. We will notify you of significant changes by email or by posting a notice on the app. Continued use of Sleektrade after changes constitutes acceptance of the updated policy.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>9. Contact</h2>
            <p>For any privacy-related questions, contact us at <a href="mailto:support@sleektrade.app" style={{ color: '#10B981', textDecoration: 'none' }}>support@sleektrade.app</a>.</p>
          </div>
        </div>

        <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid var(--brd)', display: 'flex', gap: '20px', fontSize: '12px' }}>
          <Link href="/" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>← Back to home</Link>
          <Link href="/terms" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Terms & Conditions</Link>
          <Link href="/contact" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Contact</Link>
        </div>
      </div>
    </div>
  )
}
