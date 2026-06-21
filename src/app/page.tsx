import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PricingSection } from '@/components/PricingSection'

const Logo = () => (
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
)

const SmallLogo = () => (
  <svg width="18" height="18" viewBox="0 0 64 64">
    <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
    <polyline points="11,51 22,39 33,45 51,27" fill="none" stroke="#5DCAA5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const MockWrap = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: 'var(--bg2)', border: '1px solid var(--brd2)',
    borderRadius: '16px', padding: '20px',
    boxShadow: '0 0 0 1px var(--brd)',
    flex: 1,
  }}>{children}</div>
)

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--txt)', fontFamily: 'var(--sans)', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '60px', borderBottom: '1px solid var(--brd)',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,13,17,0.95)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Logo />
          <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.01em' }}>
            Sleek<span style={{ color: '#1D9E75' }}>trade</span>
          </span>
        </div>
        {/* Desktop nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }} className="desktop-nav-links">
          <a href="#features" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Pricing</a>
          <a href="#who" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Who it's for</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/login" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--txt2)', textDecoration: 'none', padding: '7px 12px' }} className="desktop-login">Log in</Link>
          <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none', whiteSpace: 'nowrap' }}>Start for free</Link>
        </div>
      </nav>

      <style>{`
        @media (max-width: 640px) {
          .desktop-nav-links { display: none !important; }
          .desktop-login { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; padding: 40px 20px 32px !important; }
          .hero-mock { display: none !important; }
          .hero-h1 { font-size: 36px !important; }
          .feature-grid { grid-template-columns: 1fr !important; gap: 40px !important; margin-bottom: 60px !important; }
          .feature-mock-order { order: -1 !important; }
          .who-grid { grid-template-columns: 1fr !important; }
          .section-pad { padding: 48px 20px !important; }
          .section-h2 { font-size: 26px !important; }
          .footer-flex { flex-direction: column !important; gap: 16px !important; text-align: center !important; }
          .footer-links { justify-content: center !important; }
          .cta-h2 { font-size: 28px !important; }
          .feature-h3 { font-size: 24px !important; }
        }
      `}</style>

      {/* HERO */}
      <section className="hero-grid" style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 48px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '4px 14px', marginBottom: '24px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Built for active traders
          </div>
          <h1 className="hero-h1" style={{ fontSize: '52px', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: '20px' }}>
            Know exactly why<br /><span style={{ color: '#10B981' }}>you win and lose.</span>
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '36px' }}>
            Sleektrade is the professional trading journal that turns your raw trade data into clear, actionable insight — so you can grow your edge, not just your screen time.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ fontSize: '15px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '10px', padding: '14px 28px', textDecoration: 'none' }}>Start for free</Link>
            <a href="#features" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--txt2)', background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: '10px', padding: '14px 24px', textDecoration: 'none' }}>See features →</a>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--txt3)', marginTop: '14px' }}>No credit card required · Free plan available</p>
        </div>
        <div className="hero-mock">
          <MockWrap>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Dashboard</span>
              <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>June 2026</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '12px' }}>
              {[{ l: 'Net P&L', v: '+$4,821' }, { l: 'Win Rate', v: '67.3%' }, { l: 'Profit Factor', v: '2.14' }].map(m => (
                <div key={m.l} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.l}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#10B981' }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '8px' }}>Cumulative P&L</div>
              <svg viewBox="0 0 300 70" width="100%" height="70">
                <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/><stop offset="100%" stopColor="#10B981" stopOpacity="0"/></linearGradient></defs>
                <path d="M0,65 L30,58 L60,50 L90,44 L120,48 L150,36 L180,26 L210,20 L240,12 L270,7 L300,3" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
                <path d="M0,65 L30,58 L60,50 L90,44 L120,48 L150,36 L180,26 L210,20 L240,12 L270,7 L300,3 L300,70 L0,70Z" fill="url(#hg)"/>
              </svg>
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', overflow: 'hidden' }}>
              {[{ sym: 'NVDA', side: 'LONG', pnl: '+$842', c: '#10B981' }, { sym: 'TSLA', side: 'SHORT', pnl: '-$210', c: '#EF4444' }, { sym: 'AAPL', side: 'LONG', pnl: '+$390', c: '#10B981' }].map((t, i) => (
                <div key={t.sym} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '7px 12px', borderBottom: i < 2 ? '1px solid var(--brd)' : 'none' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700 }}>{t.sym}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: t.c }}>{t.side}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: t.c, textAlign: 'right' }}>{t.pnl}</span>
                </div>
              ))}
            </div>
          </MockWrap>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 48px 80px' }} className="section-pad">
        <div style={{ textAlign: 'center', marginBottom: '72px' }}>
          <h2 className="section-h2" style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '12px' }}>Everything a serious trader needs</h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)' }}>Built around your real workflow — not a generic spreadsheet.</p>
        </div>

        {/* Feature 1 */}
        <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '72px', alignItems: 'center', marginBottom: '100px' }}>
          <div>
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '3px 12px', marginBottom: '16px' }}>Reports</div>
            <h3 className="feature-h3" style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px', lineHeight: 1.2 }}>7 report tabs.<br />25+ metrics.</h3>
            <p style={{ fontSize: '15px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '20px' }}>
              Understand your performance at every level — by day, by time of day, by symbol, by setup.
            </p>
            {['Performance & Overview', 'Day & Time analysis', 'Symbols & Setups', 'Risk / R-Multiple', 'Win vs Loss breakdown'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: '14px' }}>✓</span> {f}
              </div>
            ))}
          </div>
          <MockWrap>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', overflowX: 'auto' }}>
              {['Performance', 'Overview', 'Day & Time', 'Symbols', 'Risk/R', 'Win/Loss', 'Setups'].map((t, i) => (
                <div key={t} style={{ fontSize: '9px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', whiteSpace: 'nowrap', background: i === 0 ? '#10B981' : 'var(--bg3)', color: i === 0 ? '#000' : 'var(--txt3)', border: '1px solid var(--brd)' }}>{t}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '12px' }}>
              {[{ l: 'Total Trades', v: '142' }, { l: 'Avg Win', v: '+$384' }, { l: 'Avg Loss', v: '-$180' }, { l: 'Best Day', v: '+$1,240' }, { l: 'Worst Day', v: '-$420' }, { l: 'Avg Hold', v: '18 min' }].map(m => (
                <div key={m.l} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontSize: '8px', color: 'var(--txt3)', marginBottom: '2px' }}>{m.l}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981' }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '8px' }}>P&L by Day of Week</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '50px' }}>
                {[{ d: 'Mon', h: 35, c: '#10B981' }, { d: 'Tue', h: 45, c: '#10B981' }, { d: 'Wed', h: 20, c: '#EF4444' }, { d: 'Thu', h: 40, c: '#10B981' }, { d: 'Fri', h: 30, c: '#10B981' }].map(b => (
                  <div key={b.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${b.h}px`, background: b.c, borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
                    <div style={{ fontSize: '8px', color: 'var(--txt3)' }}>{b.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </MockWrap>
        </div>

        {/* Feature 2 */}
        <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '72px', alignItems: 'center', marginBottom: '100px' }}>
          <div className="feature-mock-order">
            <MockWrap>
              <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '10px' }}>Trade View</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                {['All Trades', 'LONG', 'SHORT', 'Winners', 'Losers'].map((f, i) => (
                  <div key={f} style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '6px', background: i === 0 ? '#10B981' : 'var(--bg3)', color: i === 0 ? '#000' : 'var(--txt3)', border: '1px solid var(--brd)', fontWeight: 600 }}>{f}</div>
                ))}
              </div>
              {[
                { date: 'Jun 19', sym: 'NVDA', side: 'LONG', pnl: '+$842', grade: 'A', gc: '#10B981' },
                { date: 'Jun 19', sym: 'TSLA', side: 'SHORT', pnl: '-$210', grade: 'C', gc: '#f59e0b' },
                { date: 'Jun 18', sym: 'AAPL', side: 'LONG', pnl: '+$390', grade: 'B', gc: '#10B981' },
              ].map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', padding: '7px 8px', borderBottom: '1px solid var(--brd)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{t.date}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700 }}>{t.sym}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: t.side === 'LONG' ? '#10B981' : '#EF4444' }}>{t.side}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: t.pnl.startsWith('+') ? '#10B981' : '#EF4444' }}>{t.pnl}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: t.gc }}>{t.grade}</span>
                </div>
              ))}
            </MockWrap>
          </div>
          <div>
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '3px 12px', marginBottom: '16px' }}>Trade View</div>
            <h3 className="feature-h3" style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px', lineHeight: 1.2 }}>Every trade.<br />Crystal clear.</h3>
            <p style={{ fontSize: '15px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '20px' }}>
              Log, filter, edit, and review every trade. Add grades, screenshots, notes, and setups.
            </p>
            {['Filter by side, result, date, setup', 'Grade each trade A–D', 'Attach screenshots', 'Edit or delete any trade', 'Bulk delete with filters'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: '14px' }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" style={{ background: 'var(--bg2)', borderTop: '1px solid var(--brd)', borderBottom: '1px solid var(--brd)', padding: '80px 48px' }} className="section-pad">
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="section-h2" style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px' }}>Built for traders who are serious about their edge</h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '40px' }}>
            Whether you scalp momentum plays, swing trade setups, or trade Nasdaq futures — Sleektrade gives you the data to understand your own performance with precision.
          </p>
          <div className="who-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
            {[
              { label: 'Day traders', desc: 'Track intraday scalps with hold-time accuracy down to the minute.' },
              { label: 'Swing traders', desc: 'Review multi-day positions and identify your best setups over time.' },
              { label: 'Futures traders', desc: 'Log NQ, ES, MNQ and more. Works with NinjaTrader, TradeStation, Tastytrade & Tradovate.' },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '10px', padding: '22px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981', marginBottom: '8px' }}>{item.label}</div>
                <div style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <PricingSection />

      {/* FINAL CTA */}
      <section style={{ textAlign: 'center', padding: '80px 24px', borderTop: '1px solid var(--brd)', background: 'var(--bg2)' }}>
        <h2 className="cta-h2" style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px' }}>Stop guessing. Start knowing.</h2>
        <p style={{ fontSize: '16px', color: 'var(--txt2)', marginBottom: '32px' }}>Join traders who use Sleektrade to understand their performance and trade with confidence.</p>
        <Link href="/signup" style={{ fontSize: '15px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '10px', padding: '15px 36px', textDecoration: 'none', display: 'inline-block' }}>Create your free account</Link>
        <p style={{ fontSize: '12px', color: 'var(--txt3)', marginTop: '14px' }}>No credit card required · Cancel anytime</p>
      </section>

      {/* FOOTER */}
      <footer className="footer-flex" style={{ borderTop: '1px solid var(--brd)', padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--txt3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SmallLogo />
          <span>© 2026 Sleektrade. All rights reserved.</span>
        </div>
        <div className="footer-links" style={{ display: 'flex', gap: '24px' }}>
          <a href="#features" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Pricing</a>
          <Link href="/login" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Log in</Link>
          <Link href="/signup" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>Sign up</Link>
        </div>
      </footer>

    </div>
  )
}
