import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--txt)', fontFamily: 'var(--sans)', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: '68px',
        borderBottom: '1px solid var(--brd)',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,13,17,0.95)', backdropFilter: 'blur(12px)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="38" height="38" viewBox="0 0 64 64">
            <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
            <rect x="11" y="13" width="42" height="4" rx="2" fill="#5DCAA5"/>
            <rect x="11" y="21" width="42" height="4" rx="2" fill="#5DCAA5" opacity={0.5}/>
            <rect x="11" y="29" width="28" height="4" rx="2" fill="#5DCAA5" opacity={0.22}/>
            <polyline points="11,51 22,39 33,45 51,27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="11" cy="51" r="2.5" fill="#5DCAA5" opacity={0.7}/>
            <circle cx="22" cy="39" r="2.5" fill="#5DCAA5" opacity={0.7}/>
            <circle cx="33" cy="45" r="2.5" fill="#5DCAA5" opacity={0.7}/>
            <circle cx="51" cy="27" r="3.5" fill="#5DCAA5"/>
          </svg>
          <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-.01em' }}>
            Sleek<span style={{ color: '#1D9E75' }}>trade</span>
          </span>
        </div>
        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <a href="#features" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Pricing</a>
          <a href="#who" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Who it's for</a>
        </div>
        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/login" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--txt2)', textDecoration: 'none', padding: '7px 16px' }}>Log in</Link>
          <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '9px 20px', textDecoration: 'none' }}>Start for free</Link>
        </div>
      </nav>

      {/* HERO — two column layout */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 48px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
        {/* Left: text */}
        <div>
          <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '4px 14px', marginBottom: '24px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Built for active traders
          </div>
          <h1 style={{ fontSize: '52px', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: '20px', color: 'var(--txt)' }}>
            Know exactly why<br />
            <span style={{ color: '#10B981' }}>you win and lose.</span>
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '36px' }}>
            Sleektrade is the professional trading journal that turns your raw trade data into clear, actionable insight — so you can grow your edge, not just your screen time.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ fontSize: '15px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '10px', padding: '14px 28px', textDecoration: 'none' }}>
              Start for free
            </Link>
            <a href="#features" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--txt2)', background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: '10px', padding: '14px 24px', textDecoration: 'none' }}>
              See features →
            </a>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--txt3)', marginTop: '14px' }}>No credit card required · Free plan available</p>
        </div>

        {/* Right: fake dashboard mockup */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd2)', borderRadius: '16px', padding: '20px', boxShadow: '0 0 0 1px var(--brd)' }}>
          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)' }}>Dashboard</span>
            <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>June 2026</span>
          </div>
          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
            {[
              { label: 'Net P&L', value: '+$4,821', color: '#10B981' },
              { label: 'Win Rate', value: '67.3%', color: '#10B981' },
              { label: 'Profit Factor', value: '2.14', color: '#10B981' },
            ].map((m, i) => (
              <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
          {/* Fake chart */}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '10px' }}>Cumulative P&L</div>
            <svg viewBox="0 0 300 80" width="100%" height="80">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,70 L30,65 L60,58 L90,50 L120,55 L150,42 L180,30 L210,25 L240,15 L270,10 L300,5" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
              <path d="M0,70 L30,65 L60,58 L90,50 L120,55 L150,42 L180,30 L210,25 L240,15 L270,10 L300,5 L300,80 L0,80 Z" fill="url(#chartGrad)"/>
            </svg>
          </div>
          {/* Trade rows */}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '7px 12px', borderBottom: '1px solid var(--brd)' }}>
              {['Symbol', 'Side', 'P&L', 'Date'].map(h => (
                <span key={h} style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</span>
              ))}
            </div>
            {[
              { sym: 'NVDA', side: 'LONG', pnl: '+$842', color: '#10B981', date: 'Jun 19' },
              { sym: 'TSLA', side: 'SHORT', pnl: '-$210', color: '#EF4444', date: 'Jun 19' },
              { sym: 'AAPL', side: 'LONG', pnl: '+$390', color: '#10B981', date: 'Jun 18' },
              { sym: 'AMD', side: 'LONG', pnl: '+$615', color: '#10B981', date: 'Jun 18' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '7px 12px', borderBottom: i < 3 ? '1px solid var(--brd)' : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt)' }}>{t.sym}</span>
                <span style={{ fontSize: '10px', color: t.side === 'LONG' ? '#10B981' : '#EF4444', fontWeight: 600 }}>{t.side}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: t.color, fontFamily: 'var(--mono)' }}>{t.pnl}</span>
                <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{t.date}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ maxWidth: '1100px', margin: '0 auto', padding: '80px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h2 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '12px' }}>Everything a serious trader needs</h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)' }}>Built around your real workflow — not a generic spreadsheet.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { icon: '📊', title: 'P&L Dashboard', desc: 'Cumulative P&L chart, daily bars, drawdown tracker, weekly sidebar, and a calendar showing every trading day at a glance.' },
            { icon: '📥', title: 'DAS Trader Importer', desc: 'Paste your DAS export and trades are parsed instantly — including date, entry & exit times, and exact hold duration.' },
            { icon: '📈', title: '7-Tab Reports', desc: 'Performance, Overview, Day & Time, Symbols, Risk/R-Multiple, Win vs Loss, and Setups — 25+ metrics across all tabs.' },
            { icon: '📐', title: 'Position Size Calculator', desc: 'Calculate your exact share size based on account size, risk percentage, and stop distance before every trade.' },
            { icon: '📓', title: 'Notebook & Strategies', desc: 'Log your trade ideas, rules, and strategy notes directly inside your journal — everything in one place.' },
            { icon: '🔒', title: 'Backup & Restore', desc: 'Export your full trading history any time. Restore it in one click. Your data is always yours.' },
          ].map((f, i) => (
            <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', padding: '24px', transition: '.15s' }}>
              <div style={{ fontSize: '30px', marginBottom: '14px' }}>{f.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--txt)' }}>{f.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" style={{ background: 'var(--bg2)', borderTop: '1px solid var(--brd)', borderBottom: '1px solid var(--brd)', padding: '80px 48px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px' }}>Built for traders who are serious about their edge</h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '40px' }}>
            Whether you scalp momentum plays, swing trade setups, or trade Nasdaq futures — Sleektrade gives you the data to understand your own performance with precision.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'Day traders', desc: 'Track intraday scalps with hold-time accuracy down to the minute.' },
              { label: 'Swing traders', desc: 'Review multi-day positions and identify your best setups over time.' },
              { label: 'Futures traders', desc: 'Manually log NQ, ES, and other futures trades alongside your equity trades.' },
            ].map((item, i) => (
              <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '10px', padding: '22px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981', marginBottom: '8px' }}>{item.label}</div>
                <div style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '12px' }}>Simple, honest pricing</h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)' }}>Start free. Upgrade when you're ready.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Free */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '14px', padding: '28px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Free</div>
            <div style={{ fontSize: '40px', fontWeight: 800, marginBottom: '4px' }}>$0</div>
            <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '24px' }}>Forever free</div>
            {['Up to 50 trades/month', 'Dashboard & Trade View', 'Basic reports', 'Position size calculator'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
            <Link href="/signup" style={{ display: 'block', textAlign: 'center', marginTop: '28px', fontSize: '13px', fontWeight: 600, color: 'var(--txt)', background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: '8px', padding: '11px', textDecoration: 'none' }}>
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div style={{ background: 'var(--bg2)', border: '2px solid #10B981', borderRadius: '14px', padding: '28px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: '#10B981', color: '#000', fontSize: '10px', fontWeight: 800, padding: '3px 14px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
              MOST POPULAR
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Pro</div>
            <div style={{ fontSize: '40px', fontWeight: 800, marginBottom: '4px' }}>$29</div>
            <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '24px' }}>per month</div>
            {['Unlimited trades', 'All 7 report tabs', '25+ performance metrics', 'DAS Trader importer', 'Notebook & Strategies', 'Backup & restore'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
            <Link href="/signup" style={{ display: 'block', textAlign: 'center', marginTop: '28px', fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '11px', textDecoration: 'none' }}>
              Start free trial
            </Link>
          </div>

          {/* Elite */}
          <div style={{ background: 'linear-gradient(145deg, #0f1f1a, #0a1a14)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '14px', padding: '28px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Elite</div>
            <div style={{ fontSize: '40px', fontWeight: 800, marginBottom: '4px' }}>$59</div>
            <div style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '24px' }}>per month</div>
            {['Everything in Pro', 'Priority support', 'Early access to new features', 'Broker integrations (coming soon)', 'Advanced AI trade insights (soon)', 'Custom report exports'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
            <Link href="/signup" style={{ display: 'block', textAlign: 'center', marginTop: '28px', fontSize: '13px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '8px', padding: '11px', textDecoration: 'none' }}>
              Get Elite access
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ textAlign: 'center', padding: '80px 24px', borderTop: '1px solid var(--brd)', background: 'var(--bg2)' }}>
        <h2 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px' }}>Stop guessing. Start knowing.</h2>
        <p style={{ fontSize: '16px', color: 'var(--txt2)', marginBottom: '32px' }}>
          Join traders who use Sleektrade to understand their performance and trade with confidence.
        </p>
        <Link href="/signup" style={{ fontSize: '15px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '10px', padding: '15px 36px', textDecoration: 'none', display: 'inline-block' }}>
          Create your free account
        </Link>
        <p style={{ fontSize: '12px', color: 'var(--txt3)', marginTop: '14px' }}>No credit card required · Cancel anytime</p>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--brd)', padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--txt3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 64 64">
            <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
            <polyline points="11,51 22,39 33,45 51,27" fill="none" stroke="#5DCAA5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>© 2026 Sleektrade. All rights reserved.</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a href="#features" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Pricing</a>
          <Link href="/login" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Log in</Link>
          <Link href="/signup" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Sign up</Link>
        </div>
      </footer>

    </div>
  )
}
