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

// Reusable mock card wrapper
const MockWrap = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: 'var(--bg2)', border: '1px solid var(--brd2)',
    borderRadius: '16px', padding: '20px',
    boxShadow: '0 0 0 1px var(--brd)',
    flex: 1,
  }}>{children}</div>
)

const MiniBar = ({ h, color = '#10B981' }: { h: number, color?: string }) => (
  <div style={{ width: '100%', height: `${h}px`, background: color, borderRadius: '3px 3px 0 0' }} />
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
        padding: '0 48px', height: '68px', borderBottom: '1px solid var(--brd)',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,13,17,0.95)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Logo />
          <span style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-.01em' }}>
            Sleek<span style={{ color: '#1D9E75' }}>trade</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <a href="#features" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Pricing</a>
          <a href="#who" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Who it's for</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/login" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--txt2)', textDecoration: 'none', padding: '7px 16px' }}>Log in</Link>
          <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '9px 20px', textDecoration: 'none' }}>Start for free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 48px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '4px 14px', marginBottom: '24px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Built for active traders
          </div>
          <h1 style={{ fontSize: '52px', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: '20px' }}>
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
        {/* Hero mockup */}
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
      </section>

      {/* FEATURE SECTIONS */}
      <section id="features" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 48px 80px' }}>

        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '72px' }}>
          <h2 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '12px' }}>Everything a serious trader needs</h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)' }}>Built around your real workflow — not a generic spreadsheet.</p>
        </div>

        {/* Feature 1 — Reports (text left, mock right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '72px', alignItems: 'center', marginBottom: '100px' }}>
          <div>
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '3px 12px', marginBottom: '16px' }}>Reports</div>
            <h3 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px', lineHeight: 1.2 }}>7 report tabs.<br />25+ metrics.</h3>
            <p style={{ fontSize: '15px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '20px' }}>
              Understand your performance at every level — by day, by time of day, by symbol, by setup. Sleektrade breaks down your trades so you can see exactly where your edge is and where you're leaking money.
            </p>
            {['Performance & Overview', 'Day & Time analysis', 'Symbols & Setups', 'Risk / R-Multiple', 'Win vs Loss breakdown'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: '14px' }}>✓</span> {f}
              </div>
            ))}
          </div>
          <MockWrap>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', overflowX: 'auto' }}>
              {['Performance', 'Overview', 'Day & Time', 'Symbols', 'Risk/R', 'Win/Loss', 'Setups'].map((t, i) => (
                <div key={t} style={{ fontSize: '9px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', whiteSpace: 'nowrap', background: i === 0 ? '#10B981' : 'var(--bg3)', color: i === 0 ? '#000' : 'var(--txt3)', border: '1px solid var(--brd)' }}>{t}</div>
              ))}
            </div>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '12px' }}>
              {[{ l: 'Total Trades', v: '142' }, { l: 'Avg Win', v: '+$384' }, { l: 'Avg Loss', v: '-$180' }, { l: 'Best Day', v: '+$1,240' }, { l: 'Worst Day', v: '-$420' }, { l: 'Avg Hold', v: '18 min' }].map(m => (
                <div key={m.l} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontSize: '8px', color: 'var(--txt3)', marginBottom: '2px' }}>{m.l}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981' }}>{m.v}</div>
                </div>
              ))}
            </div>
            {/* Bar chart */}
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

        {/* Feature 2 — Trade View (mock left, text right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '72px', alignItems: 'center', marginBottom: '100px' }}>
          <MockWrap>
            <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '10px' }}>Trade View</div>
            {/* Filter row */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {['All Trades', 'LONG', 'SHORT', 'Winners', 'Losers'].map((f, i) => (
                <div key={f} style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '6px', background: i === 0 ? '#10B981' : 'var(--bg3)', color: i === 0 ? '#000' : 'var(--txt3)', border: '1px solid var(--brd)', fontWeight: 600 }}>{f}</div>
              ))}
            </div>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', padding: '6px 8px', background: 'var(--bg3)', borderRadius: '6px 6px 0 0', marginBottom: '1px' }}>
              {['Date', 'Symbol', 'Side', 'P&L', 'Grade'].map(h => (
                <span key={h} style={{ fontSize: '8px', color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</span>
              ))}
            </div>
            {/* Rows */}
            {[
              { date: 'Jun 19', sym: 'NVDA', side: 'LONG', pnl: '+$842', grade: 'A', gc: '#10B981' },
              { date: 'Jun 19', sym: 'TSLA', side: 'SHORT', pnl: '-$210', grade: 'C', gc: '#f59e0b' },
              { date: 'Jun 18', sym: 'AAPL', side: 'LONG', pnl: '+$390', grade: 'B', gc: '#10B981' },
              { date: 'Jun 18', sym: 'AMD', side: 'LONG', pnl: '+$615', grade: 'A', gc: '#10B981' },
              { date: 'Jun 17', sym: 'META', side: 'SHORT', pnl: '-$95', grade: 'B', gc: '#10B981' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', padding: '7px 8px', borderBottom: '1px solid var(--brd)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{t.date}</span>
                <span style={{ fontSize: '10px', fontWeight: 700 }}>{t.sym}</span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: t.side === 'LONG' ? '#10B981' : '#EF4444' }}>{t.side}</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: t.pnl.startsWith('+') ? '#10B981' : '#EF4444' }}>{t.pnl}</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: t.gc }}>{t.grade}</span>
              </div>
            ))}
            {/* Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', marginTop: '2px', background: 'var(--bg3)', borderRadius: '0 0 6px 6px' }}>
              <span style={{ fontSize: '9px', color: 'var(--txt3)' }}>142 trades</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#10B981' }}>Net: +$4,821</span>
            </div>
          </MockWrap>
          <div>
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '3px 12px', marginBottom: '16px' }}>Trade View</div>
            <h3 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px', lineHeight: 1.2 }}>Every trade.<br />Crystal clear.</h3>
            <p style={{ fontSize: '15px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '20px' }}>
              Log, filter, edit, and review every trade you've ever taken. Add grades, screenshots, notes, and setups. Sort by any column. See your full history or drill into a single day.
            </p>
            {['Filter by side, result, date, setup', 'Grade each trade A–D', 'Attach screenshots', 'Edit or delete any trade', 'Bulk delete with filters'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: '14px' }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>

        {/* Feature 3 — DAS Importer (text left, mock right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '72px', alignItems: 'center', marginBottom: '100px' }}>
          <div>
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '3px 12px', marginBottom: '16px' }}>DAS Importer</div>
            <h3 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px', lineHeight: 1.2 }}>Import in<br />one click.</h3>
            <p style={{ fontSize: '15px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '20px' }}>
              Export your trades from DAS Trader, paste the data, and Sleektrade does the rest. It automatically parses your date, entry time, exit time, and hold duration — even if your export has no date column.
            </p>
            {['Paste raw DAS export data', 'Auto-detects date from Cloid', 'Captures entry & exit times', 'Calculates exact hold duration', 'Skips duplicate trades automatically'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: '14px' }}>✓</span> {f}
              </div>
            ))}
          </div>
          <MockWrap>
            <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>Import DAS Trader</div>
            {/* Paste area */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '12px', marginBottom: '10px', fontFamily: 'var(--mono)' }}>
              <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '6px' }}>Paste your DAS export here</div>
              {['Time  Symbol  Side  Price  Qty  Cloid', '09:32  NVDA  B  480.50  100  260619...', '09:44  NVDA  S  483.92  100  260619...', '10:15  TSLA  S  245.10  50   260619...', '10:28  TSLA  B  243.00  50   260619...'].map((row, i) => (
                <div key={i} style={{ fontSize: '9px', color: i === 0 ? 'var(--txt3)' : 'var(--txt2)', padding: '2px 0', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row}</div>
              ))}
            </div>
            {/* Parse result */}
            <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#10B981', marginBottom: '6px' }}>✓ 2 trades detected — Jun 19, 2026</div>
              {[{ sym: 'NVDA', side: 'LONG', entry: '$480.50', exit: '$483.92', hold: '12 min', pnl: '+$342' }, { sym: 'TSLA', side: 'SHORT', entry: '$245.10', exit: '$243.00', hold: '13 min', pnl: '+$105' }].map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '2px', padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(16,185,129,.15)' : 'none' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700 }}>{t.sym}</span>
                  <span style={{ fontSize: '9px', color: '#10B981' }}>{t.side}</span>
                  <span style={{ fontSize: '9px', color: 'var(--txt3)' }}>{t.entry}</span>
                  <span style={{ fontSize: '9px', color: 'var(--txt3)' }}>{t.exit}</span>
                  <span style={{ fontSize: '9px', color: 'var(--txt3)' }}>{t.hold}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#10B981' }}>{t.pnl}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#10B981', borderRadius: '8px', padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#000' }}>Import 2 trades →</div>
          </MockWrap>
        </div>

        {/* Feature 4 — Dashboard Calendar (mock left, text right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '72px', alignItems: 'center', marginBottom: '60px' }}>
          <MockWrap>
            <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>June 2026</div>
            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '3px', marginBottom: '12px' }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ fontSize: '8px', color: 'var(--txt3)', textAlign: 'center', padding: '2px 0', fontWeight: 700 }}>{d}</div>
              ))}
              {[null,null,null,null,null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30].map((d, i) => {
                const greenDays = [2,3,5,9,10,12,16,17,18,23,24,25]
                const redDays = [4,11,19]
                const isGreen = d && greenDays.includes(d)
                const isRed = d && redDays.includes(d)
                const isToday = d === 19
                return (
                  <div key={i} style={{
                    height: '28px', borderRadius: '5px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: isGreen ? 'rgba(16,185,129,.15)' : isRed ? 'rgba(239,68,68,.12)' : d ? 'var(--bg3)' : 'transparent',
                    border: isToday ? '1px solid #10B981' : '1px solid transparent',
                    cursor: d ? 'pointer' : 'default',
                  }}>
                    {d && <span style={{ fontSize: '9px', color: isGreen ? '#10B981' : isRed ? '#EF4444' : 'var(--txt3)', fontWeight: 600 }}>{d}</span>}
                    {isGreen && <span style={{ fontSize: '7px', color: '#10B981', fontWeight: 700 }}>+</span>}
                    {isRed && <span style={{ fontSize: '7px', color: '#EF4444', fontWeight: 700 }}>-</span>}
                  </div>
                )
              })}
            </div>
            {/* Weekly sidebar */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '8px' }}>
              <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '6px', fontWeight: 700 }}>WEEKLY SUMMARY</div>
              {[{ w: 'Week 1', pnl: '$0', days: 0 }, { w: 'Week 2', pnl: '+$842', days: 3 }, { w: 'Week 3', pnl: '+$1,920', days: 4 }, { w: 'Week 4', pnl: '+$2,059', days: 4 }].map(w => (
                <div key={w.w} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--brd)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--txt2)' }}>{w.w}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: w.pnl.startsWith('+') ? '#10B981' : 'var(--txt3)' }}>{w.pnl}</span>
                </div>
              ))}
            </div>
          </MockWrap>
          <div>
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '3px 12px', marginBottom: '16px' }}>Dashboard</div>
            <h3 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px', lineHeight: 1.2 }}>See your month<br />at a glance.</h3>
            <p style={{ fontSize: '15px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '20px' }}>
              The trading calendar shows every day color-coded by profit or loss. Click any day to see a full trade summary. The weekly sidebar keeps your running totals front and center.
            </p>
            {['Color-coded trading calendar', 'Click any day for trade breakdown', 'Weekly P&L sidebar', 'Drawdown tracker', 'Cumulative P&L chart with $ / % toggle'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--txt2)' }}>
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: '14px' }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" style={{ background: 'var(--bg2)', borderTop: '1px solid var(--brd)', borderBottom: '1px solid var(--brd)', padding: '80px 48px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px' }}>Built for traders who are serious about their edge</h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '40px' }}>
            Whether you scalp momentum plays, swing trade setups, or trade Nasdaq futures — Sleektrade gives you the data to understand your own performance with precision.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
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
        <h2 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '16px' }}>Stop guessing. Start knowing.</h2>
        <p style={{ fontSize: '16px', color: 'var(--txt2)', marginBottom: '32px' }}>Join traders who use Sleektrade to understand their performance and trade with confidence.</p>
        <Link href="/signup" style={{ fontSize: '15px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '10px', padding: '15px 36px', textDecoration: 'none', display: 'inline-block' }}>Create your free account</Link>
        <p style={{ fontSize: '12px', color: 'var(--txt3)', marginTop: '14px' }}>No credit card required · Cancel anytime</p>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--brd)', padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--txt3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SmallLogo />
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
