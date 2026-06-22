import Link from 'next/link'

export default function TermsPage() {
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
          <h1 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-.03em', marginBottom: '12px', lineHeight: 1.1 }}>Terms & Conditions</h1>
          <p style={{ fontSize: '13px', color: 'var(--txt3)' }}>Last updated: June 2026</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px', fontSize: '14px', color: 'var(--txt2)', lineHeight: 1.8 }}>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>1. Acceptance of terms</h2>
            <p>By creating an account or using Sleektrade ("Service"), you agree to be bound by these Terms & Conditions. If you do not agree, do not use the Service. These terms apply to all users, including free and paid subscribers.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>2. Description of service</h2>
            <p>Sleektrade is a trading journal platform that allows users to log, import, and analyze their trading activity. The Service is provided for informational and record-keeping purposes only. <strong style={{ color: 'var(--txt)' }}>Sleektrade does not provide financial advice, investment recommendations, or brokerage services.</strong></p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>3. Account registration</h2>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>You must provide accurate and complete information when creating your account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 18 years old to use the Service.</li>
              <li>One person may not maintain more than one free account.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>4. Subscription and billing</h2>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Paid plans (Pro and Elite) are billed monthly or yearly as selected at checkout.</li>
              <li>Payments are processed securely by Stripe.</li>
              <li>Subscriptions renew automatically unless cancelled before the renewal date.</li>
              <li>You may cancel your subscription at any time from your account settings. You will retain access until the end of the current billing period.</li>
              <li>We do not offer refunds for partial billing periods.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>5. Acceptable use</h2>
            <p style={{ marginBottom: '10px' }}>You agree not to:</p>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to reverse engineer, hack, or disrupt the Service</li>
              <li>Share your account credentials with others</li>
              <li>Upload malicious content or attempt to compromise the platform</li>
              <li>Use the Service to scrape, collect, or misuse other users' data</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>6. Your data</h2>
            <p>You own all trade data you enter into Sleektrade. We do not claim ownership over your data. You can export or delete your data at any time. See our <Link href="/privacy" style={{ color: '#10B981', textDecoration: 'none' }}>Privacy Policy</Link> for details on how we store and protect your data.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>7. No financial advice</h2>
            <p>Sleektrade is a journaling and analytics tool. Nothing on the platform constitutes financial, investment, or trading advice. Past performance data shown in your journal does not guarantee future results. Always conduct your own research and consult a licensed financial advisor before making investment decisions.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>8. Limitation of liability</h2>
            <p>Sleektrade is provided "as is" without warranties of any kind. We are not liable for any trading losses, data loss, or damages arising from use of the Service. Our total liability to you for any claim is limited to the amount you paid us in the 3 months prior to the claim.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>9. Service availability</h2>
            <p>We aim for high availability but do not guarantee uninterrupted access. We may perform maintenance, updates, or experience downtime. We will attempt to notify users of planned maintenance in advance.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>10. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time from settings. Upon termination, your data will be deleted within 30 days.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>11. Changes to terms</h2>
            <p>We may update these terms from time to time. We will notify you by email or in-app notice for material changes. Continued use of the Service after changes take effect constitutes acceptance.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}>12. Contact</h2>
            <p>Questions about these terms? Contact us at <a href="mailto:support@sleektrade.app" style={{ color: '#10B981', textDecoration: 'none' }}>support@sleektrade.app</a>.</p>
          </div>

        </div>

        <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid var(--brd)', display: 'flex', gap: '20px', fontSize: '12px' }}>
          <Link href="/" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>← Back to home</Link>
          <Link href="/privacy" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/contact" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Contact</Link>
        </div>
      </div>
    </div>
  )
}
