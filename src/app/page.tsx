import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PricingSection } from '@/components/PricingSection'
import { Testimonials } from '@/components/Testimonials'
import { SleektradeChat } from '@/components/SleektradeChat'

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

const MockWrap = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: '#131318', border: '1px solid #252530',
    borderRadius: '16px', padding: '24px',
    boxShadow: '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04)',
    flex: 1, ...style,
  }}>{children}</div>
)

const trades = [
  { date: 'Jun 22', time: '9:32', sym: 'NVDA', side: 'LONG', entry: '132.40', exit: '134.85', shares: 200, pnl: '+$490', grade: 'A', setup: 'Breakout' },
  { date: 'Jun 22', time: '10:15', sym: 'TSLA', side: 'SHORT', entry: '248.10', exit: '244.30', shares: 150, pnl: '+$570', grade: 'A', setup: 'Reversal' },
  { date: 'Jun 22', time: '11:02', sym: 'AAPL', side: 'LONG', entry: '211.50', exit: '210.80', shares: 100, pnl: '-$70', grade: 'C', setup: 'VWAP' },
  { date: 'Jun 21', time: '9:45', sym: 'SPY', side: 'LONG', entry: '548.20', exit: '551.40', shares: 300, pnl: '+$960', grade: 'A', setup: 'Breakout' },
  { date: 'Jun 21', time: '14:30', sym: 'QQQ', side: 'SHORT', entry: '472.80', exit: '470.10', shares: 200, pnl: '+$540', grade: 'B', setup: 'Reversal' },
  { date: 'Jun 20', time: '9:38', sym: 'META', side: 'LONG', entry: '615.20', exit: '619.80', shares: 50, pnl: '+$230', grade: 'B', setup: 'VWAP' },
  { date: 'Jun 20', time: '11:20', sym: 'AMZN', side: 'LONG', entry: '198.40', exit: '196.90', shares: 200, pnl: '-$300', grade: 'D', setup: 'Breakout' },
  { date: 'Jun 19', time: '9:55', sym: 'MSFT', side: 'LONG', entry: '442.10', exit: '445.60', shares: 100, pnl: '+$350', grade: 'A', setup: 'Breakout' },
]

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
   <div style={{ background: 'var(--bg)', color: 'var(--txt)', fontFamily: 'var(--sans)', minHeight: '100vh', overflowX: 'hidden', maxWidth: '100vw', position: 'relative' }}>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }} className="desktop-nav-links">
          <a href="#features" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Pricing</a>
          <a href="#who" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Who it's for</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/login" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--txt2)', textDecoration: 'none', padding: '7px 12px', whiteSpace: 'nowrap' }} className="desktop-login">Log in</Link>
          <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none', whiteSpace: 'nowrap' }}>Start for free</Link>
        </div>
      </nav>

      <style>{`
        @keyframes scrollBrokers {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .broker-scroll-track {
          display: flex;
          animation: scrollBrokers 18s linear infinite;
          width: max-content;
        }
        .broker-scroll-track:hover { animation-play-state: paused; }
        @keyframes aiTyping {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
        .ai-dot { animation: aiTyping 1.4s infinite; }
        .ai-dot:nth-child(2) { animation-delay: 0.2s; }
        .ai-dot:nth-child(3) { animation-delay: 0.4s; }
        @media (max-width: 640px) {
          .desktop-nav-links { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; gap: 16px !important; padding: 32px 16px 24px !important; }
          .hero-mock { display: none !important; }
          .hero-h1 { font-size: 32px !important; }
          .feature-grid { grid-template-columns: 1fr !important; gap: 40px !important; margin-bottom: 60px !important; }
          .feature-mock-order { order: -1 !important; }
          .who-grid { grid-template-columns: 1fr 1fr !important; }
          .section-pad { padding: 48px 16px !important; }
          #features { padding: 48px 16px !important; }
          .section-h2 { font-size: 26px !important; }
          .footer-flex { flex-direction: column !important; gap: 20px !important; text-align: center !important; }
          .footer-links { justify-content: center !important; flex-wrap: wrap !important; }
          .footer-social { justify-content: center !important; }
          .cta-h2 { font-size: 28px !important; }
          .feature-h3 { font-size: 24px !important; }
          .report-tabs { flex-wrap: wrap !important; }
          .darklight-split { grid-template-columns: 1fr !important; }
          .darklight-right { display: none !important; }
          .possize-grid { grid-template-columns: 1fr !important; }
          .report-stats-6 { grid-template-columns: repeat(3,1fr) !important; }
          .report-row2 { grid-template-columns: 1fr !important; }
          .report-row3 { grid-template-columns: 1fr !important; }
          .report-row4 { grid-template-columns: repeat(4,1fr) !important; }
          .ai-section-grid { grid-template-columns: 1fr !important; }
          .ai-mock { display: none !important; }
          .broker-section { padding: 48px 16px !important; }
          .broker-flex { gap: 20px !important; }
          /* Mock cards scroll horizontally instead of pushing the page */
          .mock-scroll-wrap {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            margin: 0 -16px !important;
            padding: 0 16px !important;
          }
        }
        .footer-social-icon {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--brd2); color: var(--txt3);
          text-decoration: none; transition: .15s;
        }
        .footer-social-icon:hover { border-color: var(--brd3); color: var(--txt2); background: var(--bg3); }
      `}</style>

      {/* HERO */}
      <section className="hero-grid" style={{ padding: '72px 48px 0', maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '400px 1fr', gap: '48px', alignItems: 'flex-start' }}>
        <div style={{ paddingTop: '40px' }}>
          <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '4px 14px', marginBottom: '24px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Built for traders & investors
          </div>
          <h1 className="hero-h1" style={{ fontSize: '46px', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.03em', marginBottom: '20px' }}>
            Know exactly why<br /><span style={{ color: '#10B981' }}>you win and lose.</span>
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--txt2)', lineHeight: 1.7, marginBottom: '32px' }}>
            Sleektrade is the professional trading journal that turns your raw trade data into clear, actionable insight — whether you day trade, swing trade, or invest long-term.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ fontSize: '15px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '10px', padding: '14px 28px', textDecoration: 'none' }}>Start for free</Link>
            <a href="#features" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--txt2)', background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: '10px', padding: '14px 24px', textDecoration: 'none' }}>See features →</a>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--txt3)', marginTop: '14px' }}>No credit card required · Free plan available</p>
        </div>

        <div className="hero-mock" style={{
          background: '#131318', border: '1px solid #252530',
          borderRadius: '16px 16px 0 0', padding: '20px 20px 0',
          boxShadow: '0 -8px 60px rgba(16,185,129,.08), 0 0 0 1px rgba(255,255,255,.04)',
          width: '100%',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>Dashboard</span>
              <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>June 2026</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['1W','1M','3M','YTD'].map((t,i) => (
                <span key={t} style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '6px', background: i===1?'#10B981':'#1e1e26', color: i===1?'#000':'#666', border: '1px solid #2a2a35', fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '8px', marginBottom: '14px' }}>
            {[
              { l: 'Net P&L', v: '+$8,421', c: '#10B981' },
              { l: 'Win Rate', v: '71.4%', c: '#10B981' },
              { l: 'Profit Factor', v: '2.38', c: '#10B981' },
              { l: 'Total Trades', v: '84', c: '#fff' },
              { l: 'Avg Win', v: '+$384', c: '#10B981' },
              { l: 'Avg Loss', v: '-$162', c: '#EF4444' },
            ].map(m => (
              <div key={m.l} style={{ background: '#1a1a22', border: '1px solid #252530', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.l}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: m.c, fontFamily: 'monospace' }}>{m.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: '#1a1a22', border: '1px solid #252530', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '10px', color: '#555', marginBottom: '10px' }}>Cumulative P&L — June 2026</div>
              <svg viewBox="0 0 600 100" width="100%" height="100">
                <defs>
                  <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M0,95 L30,88 L60,80 L90,74 L120,78 L150,65 L180,55 L210,46 L240,38 L270,28 L300,22 L330,28 L360,18 L390,10 L420,6 L450,4 L480,3 L510,2 L540,1 L570,1 L600,0" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M0,95 L30,88 L60,80 L90,74 L120,78 L150,65 L180,55 L210,46 L240,38 L270,28 L300,22 L330,28 L360,18 L390,10 L420,6 L450,4 L480,3 L510,2 L540,1 L570,1 L600,0 L600,100 L0,100Z" fill="url(#heroGrad)"/>
                {[0,100,200,300,400,500,600].map((x,i) => (
                  <line key={i} x1={x} y1="0" x2={x} y2="100" stroke="#252530" strokeWidth="0.5"/>
                ))}
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: '#1a1a22', border: '1px solid #252530', borderRadius: '8px', padding: '12px', flex: 1 }}>
                <div style={{ fontSize: '9px', color: '#555', marginBottom: '8px' }}>P&L by Day of Week</div>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end', height: '48px' }}>
                  {[{d:'Mon',h:40,c:'#10B981'},{d:'Tue',h:60,c:'#10B981'},{d:'Wed',h:18,c:'#EF4444'},{d:'Thu',h:52,c:'#10B981'},{d:'Fri',h:35,c:'#10B981'}].map(b => (
                    <div key={b.d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', justifyContent:'flex-end' }}>
                      <div style={{ width:'100%', height:`${b.h}%`, background:b.c, borderRadius:'3px 3px 0 0', opacity:0.8 }} />
                      <div style={{ fontSize:'8px', color:'#555' }}>{b.d}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#1a1a22', border: '1px solid #252530', borderRadius: '8px', padding: '12px', flex: 1 }}>
                <div style={{ fontSize: '9px', color: '#555', marginBottom: '8px' }}>Top Symbols</div>
                {[{s:'NVDA',v:'+$2,140'},{s:'TSLA',v:'+$1,570'},{s:'SPY',v:'+$960'},{s:'QQQ',v:'+$540'}].map(x => (
                  <div key={x.s} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'5px' }}>
                    <span style={{ fontWeight:700 }}>{x.s}</span>
                    <span style={{ color:'#10B981', fontWeight:700, fontFamily:'monospace' }}>{x.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: '#1a1a22', border: '1px solid #252530', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'90px 70px 60px 80px 80px 70px 80px 60px', padding:'8px 14px', borderBottom:'1px solid #252530', background:'#16161e' }}>
              {['Date','Symbol','Side','Status','Entry','Exit','P&L','Grade'].map(h => (
                <span key={h} style={{ fontSize:'9px', color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</span>
              ))}
            </div>
            {[
              { date:'Jun 22  9:32', sym:'NVDA', side:'LONG', win:true,  entry:'132.40', exit:'134.85', pnl:'+$490', grade:'A' },
              { date:'Jun 22 10:15', sym:'TSLA', side:'SHORT', win:true,  entry:'248.10', exit:'244.30', pnl:'+$570', grade:'A' },
              { date:'Jun 22 11:02', sym:'AAPL', side:'LONG', win:false, entry:'211.50', exit:'210.80', pnl:'-$70',  grade:'C' },
              { date:'Jun 21  9:45', sym:'SPY',  side:'LONG', win:true,  entry:'548.20', exit:'551.40', pnl:'+$960', grade:'A' },
              { date:'Jun 21 14:30', sym:'QQQ',  side:'SHORT', win:true,  entry:'472.80', exit:'470.10', pnl:'+$540', grade:'B' },
              { date:'Jun 20  9:38', sym:'META', side:'LONG', win:true,  entry:'615.20', exit:'619.80', pnl:'+$230', grade:'B' },
              { date:'Jun 20 11:20', sym:'AMZN', side:'LONG', win:false, entry:'198.40', exit:'196.90', pnl:'-$300', grade:'D' },
              { date:'Jun 19  9:55', sym:'MSFT', side:'LONG', win:true,  entry:'442.10', exit:'445.60', pnl:'+$350', grade:'A' },
              { date:'Jun 19 13:40', sym:'NVDA', side:'SHORT', win:true,  entry:'135.20', exit:'133.40', pnl:'+$540', grade:'A' },
              { date:'Jun 18  9:31', sym:'SPY',  side:'LONG', win:true,  entry:'545.80', exit:'548.20', pnl:'+$960', grade:'A' },
              { date:'Jun 18 11:15', sym:'TSLA', side:'LONG', win:true,  entry:'243.60', exit:'248.10', pnl:'+$450', grade:'B' },
              { date:'Jun 17  9:35', sym:'QQQ',  side:'LONG', win:true,  entry:'468.40', exit:'472.80', pnl:'+$660', grade:'A' },
            ].map((t, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'90px 70px 60px 80px 80px 70px 80px 60px', padding:'7px 14px', borderBottom:'1px solid #1e1e26', alignItems:'center', background: i%2===0?'transparent':'rgba(255,255,255,.01)' }}>
                <span style={{ fontSize:'10px', color:'#555', fontFamily:'monospace' }}>{t.date}</span>
                <span style={{ fontSize:'12px', fontWeight:700 }}>{t.sym}</span>
                <span style={{ fontSize:'10px', fontWeight:700, color:t.side==='LONG'?'#10B981':'#EF4444' }}>{t.side}</span>
                <span><span style={{ fontSize:'9px', fontWeight:700, padding:'2px 6px', borderRadius:'4px', background:t.win?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)', color:t.win?'#10B981':'#EF4444' }}>{t.win?'Win':'Loss'}</span></span>
                <span style={{ fontSize:'10px', fontFamily:'monospace', color:'#aaa' }}>${t.entry}</span>
                <span style={{ fontSize:'10px', fontFamily:'monospace', color:'#aaa' }}>${t.exit}</span>
                <span style={{ fontSize:'12px', fontWeight:700, color:t.pnl.startsWith('+')?'#10B981':'#EF4444', fontFamily:'monospace' }}>{t.pnl}</span>
                <span style={{ fontSize:'11px', fontWeight:700 }}>
                  <span style={{ background:t.grade==='A'?'rgba(16,185,129,.15)':t.grade==='B'?'rgba(96,165,250,.15)':t.grade==='C'?'rgba(245,158,11,.15)':'rgba(239,68,68,.15)', color:t.grade==='A'?'#10B981':t.grade==='B'?'#60a5fa':t.grade==='C'?'#f59e0b':'#EF4444', padding:'2px 6px', borderRadius:'4px' }}>{t.grade}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BROKERS STRIP */}
      <section className="broker-section" style={{ borderTop: '1px solid var(--brd)', borderBottom: '1px solid var(--brd)', background: 'var(--bg2)', padding: '80px 48px', marginTop: '80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '14px' }}>
            Import your trades in seconds
          </h2>
          <p style={{ fontSize: '17px', color: 'var(--txt2)', marginBottom: '56px', maxWidth: '560px', margin: '0 auto 56px' }}>
            Connect your broker and Sleektrade turns your raw data into clear, actionable insights.
          </p>
          <div className="broker-flex" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '48px', flexWrap: 'wrap', marginBottom: '48px' }}>
            {[
              { name: 'DAS Trader', logo: '/brokers/das.png', bg: '#0A1628' },
              { name: 'ThinkOrSwim', logo: '/brokers/tos.png', bg: '#0D3B0D' },
              { name: 'Interactive Brokers', logo: '/brokers/ibkr.png', bg: '#8B0000' },
              { name: 'Webull', logo: '/brokers/webull.png', bg: '#003366' },
              { name: 'Tastytrade', logo: '/brokers/tastytrade.png', bg: '#1A0E06' },
              { name: 'TradeStation', logo: '/brokers/tradestation.png', bg: '#1A1400' },
            ].map(b => (
              <div key={b.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: b.bg, border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
                  <img src={b.logo} alt={b.name} width={48} height={48} style={{ objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: '13px', color: 'var(--txt2)', fontWeight: 600 }}>{b.name}</span>
              </div>
            ))}
          </div>
          <Link href="/signup" style={{ fontSize: '14px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '12px 28px', display: 'inline-block', textDecoration: 'none' }}>
            Start for free →
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 48px' }} className="section-pad">
        <div style={{ textAlign: 'center', marginBottom: '72px' }}>
          <h2 className="section-h2" style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '12px' }}>Everything a serious trader needs</h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)' }}>Built around your real workflow — not a generic spreadsheet.</p>
        </div>

        {/* Feature 1 — Trade View */}
        <div style={{ marginBottom: '120px' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display:'inline-block', fontSize:'11px', fontWeight:700, color:'#10B981', background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'20px', padding:'3px 12px', marginBottom:'16px' }}>Trade View</div>
            <h3 style={{ fontSize:'36px', fontWeight:800, letterSpacing:'-.02em', marginBottom:'12px', lineHeight:1.2 }}>Every trade. Crystal clear.</h3>
            <p style={{ fontSize:'16px', color:'var(--txt2)', lineHeight:1.7, maxWidth:'600px' }}>
              Log, filter, edit, and review every trade. Add grades, screenshots, notes, and setups to build a complete picture of your edge.
            </p>
          </div>
          <div className="mock-scroll-wrap"><div style={{ background:'#131318', border:'1px solid #252530', borderRadius:'16px 16px 0 0', padding:'20px 20px 0', boxShadow:'0 24px 80px rgba(0,0,0,.5)', minWidth:'640px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <span style={{ fontSize:'14px', fontWeight:700 }}>Trade View</span>
              <div style={{ display:'flex', gap:'6px' }}>
                {['All','LONG','SHORT','Winners','Losers'].map((f,i) => (
                  <span key={f} style={{ fontSize:'10px', padding:'3px 10px', borderRadius:'6px', background:i===0?'#10B981':'#1e1e26', color:i===0?'#000':'#666', border:'1px solid #2a2a35', fontWeight:600 }}>{f}</span>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'95px 70px 60px 65px 80px 80px 60px 80px 55px', padding:'8px 14px', borderBottom:'1px solid #252530', background:'#16161e', borderRadius:'6px 6px 0 0' }}>
              {['Date','Symbol','Side','Status','Entry','Exit','Shares','P&L','Grade'].map(h => (
                <span key={h} style={{ fontSize:'9px', color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</span>
              ))}
            </div>
            {[
              { date:'Jun 22  9:32', sym:'NVDA', side:'Long', win:true, entry:'132.40', exit:'134.85', shares:200, pnl:'+$490', grade:'A' },
              { date:'Jun 22 10:15', sym:'TSLA', side:'Short', win:true, entry:'248.10', exit:'244.30', shares:150, pnl:'+$570', grade:'A' },
              { date:'Jun 22 11:02', sym:'AAPL', side:'Long', win:false, entry:'211.50', exit:'210.80', shares:100, pnl:'-$70', grade:'C' },
              { date:'Jun 21  9:45', sym:'SPY', side:'Long', win:true, entry:'548.20', exit:'551.40', shares:300, pnl:'+$960', grade:'A' },
              { date:'Jun 21 14:30', sym:'QQQ', side:'Short', win:true, entry:'472.80', exit:'470.10', shares:200, pnl:'+$540', grade:'B' },
              { date:'Jun 20  9:38', sym:'META', side:'Long', win:true, entry:'615.20', exit:'619.80', shares:50, pnl:'+$230', grade:'B' },
              { date:'Jun 20 11:20', sym:'AMZN', side:'Long', win:false, entry:'198.40', exit:'196.90', shares:200, pnl:'-$300', grade:'D' },
              { date:'Jun 19  9:55', sym:'MSFT', side:'Long', win:true, entry:'442.10', exit:'445.60', shares:100, pnl:'+$350', grade:'A' },
              { date:'Jun 19 13:40', sym:'NVDA', side:'Short', win:true, entry:'135.20', exit:'133.40', shares:300, pnl:'+$540', grade:'A' },
              { date:'Jun 18  9:31', sym:'SPY', side:'Long', win:true, entry:'545.80', exit:'548.20', shares:400, pnl:'+$960', grade:'A' },
              { date:'Jun 18 11:15', sym:'TSLA', side:'Long', win:true, entry:'243.60', exit:'248.10', shares:100, pnl:'+$450', grade:'B' },
              { date:'Jun 17  9:35', sym:'QQQ', side:'Long', win:true, entry:'468.40', exit:'472.80', shares:150, pnl:'+$660', grade:'A' },
            ].map((t, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'95px 70px 60px 65px 80px 80px 60px 80px 55px', padding:'7px 14px', borderBottom:'1px solid #1e1e26', alignItems:'center', background:i%2===0?'transparent':'rgba(255,255,255,.01)' }}>
                <span style={{ fontSize:'10px', color:'#555', fontFamily:'monospace' }}>{t.date}</span>
                <span style={{ fontSize:'12px', fontWeight:700 }}>{t.sym}</span>
                <span style={{ fontSize:'10px', fontWeight:600, color:t.side==='Long'?'#10B981':'#EF4444' }}>{t.side}</span>
                <span><span style={{ fontSize:'9px', fontWeight:700, padding:'2px 6px', borderRadius:'4px', background:t.win?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)', color:t.win?'#10B981':'#EF4444' }}>{t.win?'Win':'Loss'}</span></span>
                <span style={{ fontSize:'10px', fontFamily:'monospace', color:'#aaa' }}>${t.entry}</span>
                <span style={{ fontSize:'10px', fontFamily:'monospace', color:'#aaa' }}>${t.exit}</span>
                <span style={{ fontSize:'10px', color:'#666' }}>{t.shares}</span>
                <span style={{ fontSize:'11px', fontWeight:700, color:t.pnl.startsWith('+')?'#10B981':'#EF4444', fontFamily:'monospace' }}>{t.pnl}</span>
                <span style={{ fontSize:'10px', fontWeight:700 }}>
                  <span style={{ background:t.grade==='A'?'rgba(16,185,129,.15)':t.grade==='B'?'rgba(96,165,250,.15)':t.grade==='C'?'rgba(245,158,11,.15)':'rgba(239,68,68,.15)', color:t.grade==='A'?'#10B981':t.grade==='B'?'#60a5fa':t.grade==='C'?'#f59e0b':'#EF4444', padding:'2px 5px', borderRadius:'4px' }}>{t.grade}</span>
                </span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', fontSize:'11px', color:'#555' }}>
              <span>12 trades · Jun 17 – Jun 22</span>
              <span style={{ color:'#10B981', fontWeight:700, fontFamily:'monospace' }}>Net P&L: +$5,930</span>
            </div>
          </div>
          </div>
        </div>

        {/* Feature 2 — Reports */}
        <div style={{ marginBottom: '120px' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display:'inline-block', fontSize:'11px', fontWeight:700, color:'#10B981', background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'20px', padding:'3px 12px', marginBottom:'16px' }}>Reports</div>
            <h3 style={{ fontSize:'36px', fontWeight:800, letterSpacing:'-.02em', marginBottom:'12px', lineHeight:1.2 }}>7 report tabs. 25+ metrics.</h3>
            <p style={{ fontSize:'16px', color:'var(--txt2)', lineHeight:1.7, maxWidth:'600px' }}>
              Understand your performance at every level — by day, by time of day, by symbol, by setup. Stop guessing, start knowing.
            </p>
          </div>
          <div className="mock-scroll-wrap"><div style={{ background:'#131318', border:'1px solid #252530', borderRadius:'16px 16px 0 0', padding:'20px 20px 0', boxShadow:'0 24px 80px rgba(0,0,0,.5)', minWidth:'640px' }}>
            <div className="report-tabs" style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
              {['Performance','Overview','Day & Time','Symbols','Risk/R','Win/Loss','Setups'].map((t,i) => (
                <div key={t} style={{ fontSize:'11px', fontWeight:600, padding:'6px 14px', borderRadius:'7px', background:i===0?'#10B981':'#1e1e26', color:i===0?'#000':'#666', border:'1px solid #2a2a35', cursor:'pointer', whiteSpace:'nowrap' }}>{t}</div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px', marginBottom:'14px' }}>
              {[
                { l:'Net P&L', v:'+$8,421', c:'#10B981' },
                { l:'Win Rate', v:'71.8%', c:'#10B981' },
                { l:'Profit Factor', v:'2.38', c:'#10B981' },
                { l:'Total Trades', v:'142', c:'#fff' },
                { l:'Avg Win', v:'+$384', c:'#10B981' },
                { l:'Avg Loss', v:'-$180', c:'#EF4444' },
              ].map(m => (
                <div key={m.l} style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'12px 14px' }}>
                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.06em' }}>{m.l}</div>
                  <div style={{ fontSize:'20px', fontWeight:800, color:m.c, fontFamily:'monospace' }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div className="report-row2" style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px', marginBottom:'14px' }}>
              <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#555', marginBottom:'10px' }}>Cumulative P&L — June 2026</div>
                <svg viewBox="0 0 400 80" width="100%" height="80">
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0,75 L30,68 L60,58 L90,52 L120,56 L150,44 L180,34 L210,26 L240,18 L270,12 L300,8 L330,10 L360,4 L400,1" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M0,75 L30,68 L60,58 L90,52 L120,56 L150,44 L180,34 L210,26 L240,18 L270,12 L300,8 L330,10 L360,4 L400,1 L400,80 L0,80Z" fill="url(#rg)"/>
                </svg>
              </div>
              <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#555', marginBottom:'10px' }}>Win vs Loss</div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'10px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'9px', color:'#555', marginBottom:'3px' }}>Wins</div>
                    <div style={{ fontSize:'18px', fontWeight:800, color:'#10B981', fontFamily:'monospace' }}>102</div>
                    <div style={{ fontSize:'9px', color:'#555' }}>71.8%</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'9px', color:'#555', marginBottom:'3px' }}>Losses</div>
                    <div style={{ fontSize:'18px', fontWeight:800, color:'#EF4444', fontFamily:'monospace' }}>40</div>
                    <div style={{ fontSize:'9px', color:'#555' }}>28.2%</div>
                  </div>
                </div>
                <div style={{ height:'8px', background:'#252530', borderRadius:'4px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:'71.8%', background:'#10B981', borderRadius:'4px' }} />
                </div>
              </div>
              <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#555', marginBottom:'10px' }}>Avg Hold Time</div>
                <div style={{ fontSize:'28px', fontWeight:800, fontFamily:'monospace', color:'#fff', marginBottom:'6px' }}>18 min</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {[{l:'<5 min',w:'20%',v:28},{l:'5-30 min',w:'55%',v:76},{l:'30-60 min',w:'18%',v:25},{l:'>1 hour',w:'7%',v:13}].map(x => (
                    <div key={x.l} style={{ display:'grid', gridTemplateColumns:'55px 1fr 25px', alignItems:'center', gap:'5px' }}>
                      <span style={{ fontSize:'8px', color:'#555' }}>{x.l}</span>
                      <div style={{ height:'4px', background:'#252530', borderRadius:'2px', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:x.w, background:'#10B981', borderRadius:'2px', opacity:0.8 }} />
                      </div>
                      <span style={{ fontSize:'8px', color:'#666', textAlign:'right' }}>{x.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="report-row3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'14px' }}>
              <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#555', marginBottom:'12px' }}>P&L by Day of Week</div>
                <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', height:'80px' }}>
                  {[
                    {d:'Mon',h:52,v:'+$1,240',c:'#10B981'},
                    {d:'Tue',h:75,v:'+$2,100',c:'#10B981'},
                    {d:'Wed',h:22,v:'-$420',c:'#EF4444'},
                    {d:'Thu',h:65,v:'+$1,840',c:'#10B981'},
                    {d:'Fri',h:42,v:'+$960',c:'#10B981'},
                  ].map(b => (
                    <div key={b.d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', justifyContent:'flex-end' }}>
                      <div style={{ fontSize:'8px', color:b.c, fontFamily:'monospace', fontWeight:700 }}>{b.v}</div>
                      <div style={{ width:'100%', height:`${b.h}%`, background:b.c, borderRadius:'4px 4px 0 0', opacity:0.85 }} />
                      <div style={{ fontSize:'9px', color:'#555' }}>{b.d}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#555', marginBottom:'12px' }}>P&L by Time of Day</div>
                <div style={{ display:'flex', gap:'5px', alignItems:'flex-end', height:'80px' }}>
                  {[
                    {t:'9:30',h:85,c:'#10B981'},
                    {t:'10:00',h:95,c:'#10B981'},
                    {t:'11:00',h:48,c:'#10B981'},
                    {t:'12:00',h:15,c:'#EF4444'},
                    {t:'13:00',h:22,c:'#EF4444'},
                    {t:'14:00',h:52,c:'#10B981'},
                    {t:'15:00',h:68,c:'#10B981'},
                    {t:'15:30',h:38,c:'#10B981'},
                  ].map(b => (
                    <div key={b.t} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', justifyContent:'flex-end' }}>
                      <div style={{ width:'100%', height:`${b.h}%`, background:b.c, borderRadius:'3px 3px 0 0', opacity:0.8 }} />
                      <div style={{ fontSize:'7px', color:'#555', whiteSpace:'nowrap' }}>{b.t}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#555', marginBottom:'12px' }}>Top Symbols by P&L</div>
                {[
                  {s:'NVDA',pnl:'+$2,140',trades:24,wr:'79%'},
                  {s:'TSLA',pnl:'+$1,570',trades:18,wr:'72%'},
                  {s:'SPY', pnl:'+$960', trades:31,wr:'68%'},
                  {s:'QQQ', pnl:'+$540', trades:14,wr:'64%'},
                  {s:'META',pnl:'+$380', trades:8, wr:'75%'},
                  {s:'AAPL',pnl:'-$210', trades:12,wr:'42%'},
                ].map(x => (
                  <div key={x.s} style={{ display:'grid', gridTemplateColumns:'40px 1fr 35px 65px', alignItems:'center', marginBottom:'8px', gap:'6px' }}>
                    <span style={{ fontSize:'12px', fontWeight:700 }}>{x.s}</span>
                    <div style={{ height:'5px', background:'#252530', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:x.wr, background:parseInt(x.wr)>60?'#10B981':'#EF4444', borderRadius:'3px' }} />
                    </div>
                    <span style={{ fontSize:'9px', color:'#555' }}>{x.wr}</span>
                    <span style={{ fontSize:'11px', fontWeight:700, color:x.pnl.startsWith('+')?'#10B981':'#EF4444', fontFamily:'monospace', textAlign:'right' }}>{x.pnl}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="report-row4" style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:'8px' }}>
              {[
                { l:'Avg Hold', v:'18 min' },
                { l:'Largest Win', v:'+$960' },
                { l:'Largest Loss', v:'-$420' },
                { l:'Avg R-Multiple', v:'1.84R' },
                { l:'Consec. Wins', v:'7' },
                { l:'Commission', v:'-$284' },
                { l:'Sharpe Ratio', v:'2.12' },
                { l:'Worst Day', v:'-$420' },
              ].map(m => (
                <div key={m.l} style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'10px 12px' }}>
                  <div style={{ fontSize:'8px', color:'#555', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }}>{m.l}</div>
                  <div style={{ fontSize:'14px', fontWeight:700, fontFamily:'monospace' }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* Dark/Light Mode Split */}
        <div style={{ marginBottom: '120px' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display:'inline-block', fontSize:'11px', fontWeight:700, color:'#10B981', background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'20px', padding:'3px 12px', marginBottom:'16px' }}>Dark & Light Mode</div>
            <h3 style={{ fontSize:'36px', fontWeight:800, letterSpacing:'-.02em', marginBottom:'12px', lineHeight:1.2 }}>Your preference.<br />Your journal.</h3>
            <p style={{ fontSize:'16px', color:'var(--txt2)', lineHeight:1.7, maxWidth:'600px' }}>
              Switch between dark and light mode with one click. Sleektrade looks great either way — built for traders who work at any hour.
            </p>
          </div>
          <div className="mock-scroll-wrap"><div style={{ borderRadius:'16px 16px 0 0', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.5)', border:'1px solid #252530', minWidth:'560px' }}>
            <div className="darklight-split" style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
              <div style={{ background:'#0d0d11', padding:'24px', borderRight:'2px solid #10B981' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'#062e21', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
                        <polyline points="11,51 22,39 33,45 51,27" stroke="#5DCAA5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:800, color:'#F1F1F3' }}>Sleek<span style={{ color:'#10B981' }}>trade</span></span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1a1a22', border:'1px solid #252530', borderRadius:'20px', padding:'4px 10px' }}>
                    <span style={{ fontSize:'10px', color:'#555' }}>☀️</span>
                    <div style={{ width:'28px', height:'16px', background:'#10B981', borderRadius:'8px', position:'relative' }}>
                      <div style={{ position:'absolute', right:'2px', top:'2px', width:'12px', height:'12px', background:'#fff', borderRadius:'50%' }} />
                    </div>
                    <span style={{ fontSize:'10px', color:'#10B981' }}>🌙</span>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'12px' }}>
                  {[{ l:'Net P&L', v:'+$8,421', c:'#10B981' },{ l:'Win Rate', v:'71.4%', c:'#10B981' },{ l:'Trades', v:'84', c:'#F1F1F3' }].map(m => (
                    <div key={m.l} style={{ background:'#131318', border:'1px solid #252530', borderRadius:'8px', padding:'10px 12px' }}>
                      <div style={{ fontSize:'8px', color:'#555', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }}>{m.l}</div>
                      <div style={{ fontSize:'16px', fontWeight:800, color:m.c, fontFamily:'monospace' }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:'#131318', border:'1px solid #252530', borderRadius:'8px', padding:'12px', marginBottom:'10px' }}>
                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'8px' }}>Cumulative P&L</div>
                  <svg viewBox="0 0 300 60" width="100%" height="60">
                    <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.3"/><stop offset="100%" stopColor="#10B981" stopOpacity="0"/></linearGradient></defs>
                    <path d="M0,55 L40,48 L80,38 L120,30 L160,20 L200,13 L240,7 L300,2" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M0,55 L40,48 L80,38 L120,30 L160,20 L200,13 L240,7 L300,2 L300,60 L0,60Z" fill="url(#dg)"/>
                  </svg>
                </div>
                {[
                  { sym:'NVDA', side:'LONG', pnl:'+$490', grade:'A' },
                  { sym:'TSLA', side:'SHORT', pnl:'+$570', grade:'A' },
                  { sym:'AAPL', side:'LONG', pnl:'-$70', grade:'C' },
                  { sym:'SPY', side:'LONG', pnl:'+$960', grade:'A' },
                  { sym:'QQQ', side:'SHORT', pnl:'+$540', grade:'B' },
                  { sym:'META', side:'LONG', pnl:'+$230', grade:'B' },
                  { sym:'AMZN', side:'LONG', pnl:'-$300', grade:'D' },
                  { sym:'MSFT', side:'LONG', pnl:'+$350', grade:'A' },
                ].map((t,i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', padding:'6px 8px', borderBottom:'1px solid #1e1e26', alignItems:'center' }}>
                    <span style={{ fontSize:'11px', fontWeight:700, color:'#F1F1F3' }}>{t.sym}</span>
                    <span style={{ fontSize:'10px', fontWeight:600, color:t.side==='LONG'?'#10B981':'#EF4444' }}>{t.side}</span>
                    <span style={{ fontSize:'11px', fontWeight:700, color:t.pnl.startsWith('+')?'#10B981':'#EF4444', fontFamily:'monospace' }}>{t.pnl}</span>
                    <span style={{ fontSize:'10px', fontWeight:700 }}>
                      <span style={{ background:t.grade==='A'?'rgba(16,185,129,.15)':t.grade==='B'?'rgba(96,165,250,.15)':t.grade==='C'?'rgba(245,158,11,.15)':'rgba(239,68,68,.15)', color:t.grade==='A'?'#10B981':t.grade==='B'?'#60a5fa':t.grade==='C'?'#f59e0b':'#EF4444', padding:'2px 6px', borderRadius:'4px' }}>{t.grade}</span>
                    </span>
                  </div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', margin:'10px 0' }}>
                  {[{l:'Best Day',v:'+$2,140'},{l:'Avg Hold',v:'18 min'},{l:'Profit Factor',v:'2.38'}].map(m => (
                    <div key={m.l} style={{ background:'#131318', border:'1px solid #252530', borderRadius:'6px', padding:'8px 10px' }}>
                      <div style={{ fontSize:'8px', color:'#555', marginBottom:'2px' }}>{m.l}</div>
                      <div style={{ fontSize:'12px', fontWeight:700, color:'#10B981', fontFamily:'monospace' }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign:'center', padding:'8px 0', fontSize:'11px', color:'#555', fontWeight:600 }}>🌙 Dark Mode</div>
              </div>

              <div className="darklight-right" style={{ background:'#f8f9fa', padding:'24px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'#062e21', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
                        <polyline points="11,51 22,39 33,45 51,27" stroke="#5DCAA5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:800, color:'#111' }}>Sleek<span style={{ color:'#10B981' }}>trade</span></span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#e8e8ec', border:'1px solid #d0d0d8', borderRadius:'20px', padding:'4px 10px' }}>
                    <span style={{ fontSize:'10px', color:'#10B981' }}>☀️</span>
                    <div style={{ width:'28px', height:'16px', background:'#ccc', borderRadius:'8px', position:'relative' }}>
                      <div style={{ position:'absolute', left:'2px', top:'2px', width:'12px', height:'12px', background:'#fff', borderRadius:'50%' }} />
                    </div>
                    <span style={{ fontSize:'10px', color:'#aaa' }}>🌙</span>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'12px' }}>
                  {[{ l:'Net P&L', v:'+$8,421', c:'#059669' },{ l:'Win Rate', v:'71.4%', c:'#059669' },{ l:'Trades', v:'84', c:'#111' }].map(m => (
                    <div key={m.l} style={{ background:'#fff', border:'1px solid #e0e0e8', borderRadius:'8px', padding:'10px 12px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                      <div style={{ fontSize:'8px', color:'#aaa', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }}>{m.l}</div>
                      <div style={{ fontSize:'16px', fontWeight:800, color:m.c, fontFamily:'monospace' }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:'#fff', border:'1px solid #e0e0e8', borderRadius:'8px', padding:'12px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize:'9px', color:'#aaa', marginBottom:'8px' }}>Cumulative P&L</div>
                  <svg viewBox="0 0 300 60" width="100%" height="60">
                    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.2"/><stop offset="100%" stopColor="#10B981" stopOpacity="0"/></linearGradient></defs>
                    <path d="M0,55 L40,48 L80,38 L120,30 L160,20 L200,13 L240,7 L300,2" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M0,55 L40,48 L80,38 L120,30 L160,20 L200,13 L240,7 L300,2 L300,60 L0,60Z" fill="url(#lg)"/>
                  </svg>
                </div>
                {[
                  { sym:'NVDA', side:'LONG', pnl:'+$490', grade:'A' },
                  { sym:'TSLA', side:'SHORT', pnl:'+$570', grade:'A' },
                  { sym:'AAPL', side:'LONG', pnl:'-$70', grade:'C' },
                  { sym:'SPY', side:'LONG', pnl:'+$960', grade:'A' },
                  { sym:'QQQ', side:'SHORT', pnl:'+$540', grade:'B' },
                  { sym:'META', side:'LONG', pnl:'+$230', grade:'B' },
                  { sym:'AMZN', side:'LONG', pnl:'-$300', grade:'D' },
                  { sym:'MSFT', side:'LONG', pnl:'+$350', grade:'A' },
                ].map((t,i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', padding:'6px 8px', borderBottom:'1px solid #ebebef', alignItems:'center' }}>
                    <span style={{ fontSize:'11px', fontWeight:700, color:'#111' }}>{t.sym}</span>
                    <span style={{ fontSize:'10px', fontWeight:600, color:t.side==='LONG'?'#059669':'#DC2626' }}>{t.side}</span>
                    <span style={{ fontSize:'11px', fontWeight:700, color:t.pnl.startsWith('+')?'#059669':'#DC2626', fontFamily:'monospace' }}>{t.pnl}</span>
                    <span style={{ fontSize:'10px', fontWeight:700 }}>
                      <span style={{ background:t.grade==='A'?'rgba(5,150,105,.12)':t.grade==='B'?'rgba(59,130,246,.12)':t.grade==='C'?'rgba(245,158,11,.12)':'rgba(220,38,38,.12)', color:t.grade==='A'?'#059669':t.grade==='B'?'#3b82f6':t.grade==='C'?'#d97706':'#DC2626', padding:'2px 6px', borderRadius:'4px' }}>{t.grade}</span>
                    </span>
                  </div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', margin:'10px 0' }}>
                  {[{l:'Best Day',v:'+$2,140'},{l:'Avg Hold',v:'18 min'},{l:'Profit Factor',v:'2.38'}].map(m => (
                    <div key={m.l} style={{ background:'#fff', border:'1px solid #e0e0e8', borderRadius:'6px', padding:'8px 10px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
                      <div style={{ fontSize:'8px', color:'#aaa', marginBottom:'2px' }}>{m.l}</div>
                      <div style={{ fontSize:'12px', fontWeight:700, color:'#059669', fontFamily:'monospace' }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign:'center', padding:'8px 0', fontSize:'11px', color:'#aaa', fontWeight:600 }}>☀️ Light Mode</div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Feature 3 — Journal */}
        <div style={{ marginBottom: '120px' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display:'inline-block', fontSize:'11px', fontWeight:700, color:'#10B981', background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'20px', padding:'3px 12px', marginBottom:'16px' }}>Journal</div>
            <h3 style={{ fontSize:'36px', fontWeight:800, letterSpacing:'-.02em', marginBottom:'12px', lineHeight:1.2 }}>Your trading mind. On paper.</h3>
            <p style={{ fontSize:'16px', color:'var(--txt2)', lineHeight:1.7, maxWidth:'600px' }}>
              Review every trading day in detail. See your P&L chart, stats, and every trade — by day or by week. Switch views with one click.
            </p>
          </div>
          <div className="mock-scroll-wrap"><div style={{ background:'#131318', border:'1px solid #252530', borderRadius:'16px 16px 0 0', padding:'20px 20px 0', boxShadow:'0 24px 80px rgba(0,0,0,.5)', minWidth:'560px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <span style={{ fontSize:'14px', fontWeight:700 }}>Journal</span>
              <div style={{ display:'flex', gap:'4px' }}>
                {['Day','Week'].map((v,i) => (
                  <span key={v} style={{ fontSize:'11px', padding:'5px 14px', borderRadius:'7px', background:i===1?'#10B981':'#1e1e26', color:i===1?'#000':'#666', border:'1px solid #2a2a35', fontWeight:700, cursor:'pointer' }}>{v}</span>
                ))}
              </div>
            </div>
            <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'12px 16px', marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'16px', fontWeight:800 }}>Jun 14 – Jun 20, 2026</div>
                <div style={{ fontSize:'12px', marginTop:'2px' }}>Net P&L: <span style={{ color:'#10B981', fontWeight:700 }}>+$28,629.34</span></div>
              </div>
              <div style={{ display:'flex', gap:'6px' }}>
                <span style={{ fontSize:'11px', padding:'5px 12px', borderRadius:'6px', background:'#1e1e26', color:'#666', border:'1px solid #2a2a35', cursor:'pointer' }}>← Prev</span>
                <span style={{ fontSize:'11px', padding:'5px 12px', borderRadius:'6px', background:'#1e1e26', color:'#666', border:'1px solid #2a2a35', cursor:'pointer' }}>This Week</span>
                <span style={{ fontSize:'11px', padding:'5px 12px', borderRadius:'6px', background:'#1e1e26', color:'#666', border:'1px solid #2a2a35', cursor:'pointer' }}>Next →</span>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px', marginBottom:'14px' }}>
              {[
                { day:'SUN', date:'14', pnl:null, trades:null, color:'#1a1a22' },
                { day:'MON', date:'15', pnl:'-738', trades:12, color:'rgba(239,68,68,.12)', border:'rgba(239,68,68,.25)' },
                { day:'TUE', date:'16', pnl:'+1850', trades:11, color:'rgba(16,185,129,.08)', border:'rgba(16,185,129,.2)' },
                { day:'WED', date:'17', pnl:'-498', trades:12, color:'rgba(239,68,68,.12)', border:'rgba(239,68,68,.25)', active:true },
                { day:'THU', date:'18', pnl:null, trades:null, color:'#1a1a22' },
                { day:'FRI', date:'19', pnl:'+20000', trades:11, color:'rgba(16,185,129,.08)', border:'rgba(16,185,129,.2)' },
                { day:'SAT', date:'20', pnl:null, trades:null, color:'#1a1a22' },
              ].map(d => (
                <div key={d.day} style={{ background:d.color, border:`1px solid ${d.border||'#252530'}`, borderRadius:'8px', padding:'10px', textAlign:'center', outline:d.active?'2px solid #10B981':'none' }}>
                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'2px', fontWeight:700 }}>{d.day}</div>
                  <div style={{ fontSize:'16px', fontWeight:700, color:d.pnl?'#fff':'#333', marginBottom:'2px' }}>{d.date}</div>
                  {d.pnl && <div style={{ fontSize:'11px', fontWeight:700, color:d.pnl.startsWith('+')?'#10B981':'#EF4444', fontFamily:'monospace' }}>{d.pnl.startsWith('+')?'+$':'-$'}{Math.abs(parseInt(d.pnl)).toLocaleString()}</div>}
                  {d.trades && <div style={{ fontSize:'9px', color:'#555' }}>{d.trades}t</div>}
                </div>
              ))}
            </div>
            <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'12px', marginBottom:'14px' }}>
              <svg viewBox="0 0 900 80" width="100%" height="80">
                <defs>
                  <linearGradient id="jg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M0,40 L100,40 L200,50 L280,48 L350,45 L450,42 L550,42 L650,40 L700,38 L750,15 L800,5 L900,2" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M0,40 L100,40 L200,50 L280,48 L350,45 L450,42 L550,42 L650,40 L700,38 L750,15 L800,5 L900,2 L900,80 L0,80Z" fill="url(#jg)"/>
              </svg>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px', marginBottom:'14px' }}>
              {[
                { l:'Total Trades', v:'27' },
                { l:'Win Rate', v:'40.7%' },
                { l:'Winners', v:'11' },
                { l:'Losers', v:'16' },
                { l:'Net P&L', v:'+$28,629', c:'#10B981' },
                { l:'Profit Factor', v:'12.32' },
              ].map(m => (
                <div key={m.l} style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'10px 14px' }}>
                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }}>{m.l}</div>
                  <div style={{ fontSize:'16px', fontWeight:800, color:m.c||'#fff', fontFamily:'monospace' }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px 8px 0 0', overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'110px 90px 80px 70px 90px 90px 70px 90px 70px 1fr', padding:'8px 14px', borderBottom:'1px solid #252530', background:'#16161e' }}>
                {['Day','Time','Symbol','Status','Entry','Exit','Shares','P&L','Grade','Setup'].map(h => (
                  <span key={h} style={{ fontSize:'8px', color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</span>
                ))}
              </div>
              {[
                { day:'Mon, Jun 15', time:'09:32 AM', sym:'MU', status:'Loss', entry:'$1,875.25', exit:'$1,868.04', shares:10, pnl:'-72.88', grade:'A-', setup:'Gap' },
                { day:'Mon, Jun 15', time:'09:32 AM', sym:'MU', status:'Loss', entry:'$1,875.25', exit:'$1,869.59', shares:10, pnl:'-57.35', grade:'—', setup:'—' },
                { day:'Mon, Jun 15', time:'09:35 AM', sym:'MSTR', status:'Loss', entry:'$135.35', exit:'$131.89', shares:50, pnl:'-173.79', grade:'—', setup:'—' },
                { day:'Mon, Jun 15', time:'09:51 AM', sym:'MU', status:'Win', entry:'$1,066.98', exit:'$1,067.71', shares:20, pnl:'+13.45', grade:'—', setup:'—' },
                { day:'Mon, Jun 15', time:'10:00 AM', sym:'KLAC', status:'Loss', entry:'$256.25', exit:'$257.47', shares:50, pnl:'-61.93', grade:'—', setup:'—' },
                { day:'Mon, Jun 15', time:'10:02 AM', sym:'AMD', status:'Win', entry:'$550.46', exit:'$552.95', shares:50, pnl:'+122.95', grade:'—', setup:'—' },
                { day:'Mon, Jun 15', time:'10:03 AM', sym:'MU', status:'Win', entry:'$1,060.98', exit:'$1,062.39', shares:10, pnl:'+13.17', grade:'—', setup:'—' },
                { day:'Mon, Jun 15', time:'10:06 AM', sym:'AMD', status:'Loss', entry:'$554.33', exit:'$552.22', shares:50, pnl:'-186.69', grade:'—', setup:'—' },
                { day:'Tue, Jun 16', time:'09:31 AM', sym:'SPY', status:'Win', entry:'$548.20', exit:'$551.40', shares:300, pnl:'+960.00', grade:'A', setup:'Breakout' },
                { day:'Fri, Jun 19', time:'09:30 AM', sym:'NVDA', status:'Win', entry:'$132.40', exit:'$134.85', shares:200, pnl:'+490.00', grade:'A', setup:'Breakout' },
                { day:'Fri, Jun 19', time:'10:15 AM', sym:'TSLA', status:'Win', entry:'$248.10', exit:'$244.30', shares:150, pnl:'+570.00', grade:'A', setup:'Reversal' },
              ].map((t, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'110px 90px 80px 70px 90px 90px 70px 90px 70px 1fr', padding:'7px 14px', borderBottom:'1px solid #1e1e26', alignItems:'center', background:i%2===0?'transparent':'rgba(255,255,255,.01)' }}>
                  <span style={{ fontSize:'9px', color:'#555' }}>{t.day}</span>
                  <span style={{ fontSize:'10px', color:'#555', fontFamily:'monospace' }}>{t.time}</span>
                  <span style={{ fontSize:'12px', fontWeight:700 }}>{t.sym}</span>
                  <span>
                    <span style={{ fontSize:'9px', fontWeight:700, padding:'2px 7px', borderRadius:'4px', background:t.status==='Win'?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)', color:t.status==='Win'?'#10B981':'#EF4444' }}>{t.status}</span>
                  </span>
                  <span style={{ fontSize:'10px', fontFamily:'monospace', color:'#aaa' }}>{t.entry}</span>
                  <span style={{ fontSize:'10px', fontFamily:'monospace', color:'#aaa' }}>{t.exit}</span>
                  <span style={{ fontSize:'10px', color:'#666' }}>{t.shares}</span>
                  <span style={{ fontSize:'11px', fontWeight:700, color:t.pnl.startsWith('+')?'#10B981':'#EF4444', fontFamily:'monospace' }}>{t.pnl.startsWith('+')?'+$':'-$'}{Math.abs(parseFloat(t.pnl)).toFixed(2)}</span>
                  <span style={{ fontSize:'10px', color:t.grade==='A'||t.grade==='A-'?'#10B981':'#555' }}>{t.grade}</span>
                  <span style={{ fontSize:'10px', color:'#555' }}>{t.setup}</span>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* Feature 4 — Position Size */}
        <div style={{ marginBottom: '120px' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display:'inline-block', fontSize:'11px', fontWeight:700, color:'#10B981', background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'20px', padding:'3px 12px', marginBottom:'16px' }}>Position Size</div>
            <h3 style={{ fontSize:'36px', fontWeight:800, letterSpacing:'-.02em', marginBottom:'12px', lineHeight:1.2 }}>Risk the right amount. Every time.</h3>
            <p style={{ fontSize:'16px', color:'var(--txt2)', lineHeight:1.7, maxWidth:'600px' }}>
              Enter your account size, risk percentage, entry, and stop — Sleektrade instantly tells you exactly how many shares to buy. No more guessing.
            </p>
          </div>
          <div className="mock-scroll-wrap"><div style={{ background:'#131318', border:'1px solid #252530', borderRadius:'16px 16px 0 0', padding:'20px 20px 0', boxShadow:'0 24px 80px rgba(0,0,0,.5)', minWidth:'560px' }}>
            <div style={{ fontSize:'14px', fontWeight:700, marginBottom:'16px' }}>Position Size Calculator</div>
            <div className="possize-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px' }}>
                  {[
                    { l:'Account Size', v:'$50,000', hint:'Your total trading capital' },
                    { l:'Risk %', v:'1.0%', hint:'Max loss per trade' },
                    { l:'Entry Price', v:'$132.40', hint:'Your planned entry' },
                    { l:'Stop Loss', v:'$130.50', hint:'Your stop loss price' },
                  ].map(f => (
                    <div key={f.l} style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'12px 14px' }}>
                      <div style={{ fontSize:'9px', color:'#555', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }}>{f.l}</div>
                      <div style={{ fontSize:'18px', fontWeight:700, fontFamily:'monospace' }}>{f.v}</div>
                      <div style={{ fontSize:'9px', color:'#444', marginTop:'2px' }}>{f.hint}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.3)', borderRadius:'12px', padding:'20px', textAlign:'center', marginBottom:'12px' }}>
                  <div style={{ fontSize:'11px', color:'#10B981', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'8px' }}>Shares to Buy</div>
                  <div style={{ fontSize:'52px', fontWeight:800, color:'#10B981', fontFamily:'monospace', lineHeight:1 }}>263</div>
                  <div style={{ fontSize:'12px', color:'#555', marginTop:'6px' }}>shares @ $132.40</div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
                  {[{ l:'Max Risk', v:'$500' },{ l:'Stop Distance', v:'$1.90' },{ l:'Position Size', v:'$34,801' }].map(m => (
                    <div key={m.l} style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'10px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:'8px', color:'#555', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.05em' }}>{m.l}</div>
                      <div style={{ fontSize:'13px', fontWeight:700, fontFamily:'monospace' }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'14px' }}>
                  <div style={{ fontSize:'10px', color:'#555', marginBottom:'12px', fontWeight:600 }}>R-Multiple Targets</div>
                  {[
                    { r:'1R', price:'$134.30', pnl:'+$500', pct:'+1.0%', c:'#10B981' },
                    { r:'2R', price:'$136.20', pnl:'+$1,000', pct:'+2.0%', c:'#10B981' },
                    { r:'3R', price:'$138.10', pnl:'+$1,500', pct:'+3.0%', c:'#10B981' },
                    { r:'5R', price:'$141.90', pnl:'+$2,500', pct:'+5.0%', c:'#60a5fa' },
                  ].map(t => (
                    <div key={t.r} style={{ display:'grid', gridTemplateColumns:'30px 80px 1fr 50px', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #252530', gap:'8px' }}>
                      <span style={{ fontSize:'11px', fontWeight:800, color:t.c }}>{t.r}</span>
                      <span style={{ fontSize:'11px', fontFamily:'monospace', color:'#aaa' }}>{t.price}</span>
                      <span style={{ fontSize:'12px', fontWeight:700, color:t.c, fontFamily:'monospace' }}>{t.pnl}</span>
                      <span style={{ fontSize:'10px', color:'#555', textAlign:'right' }}>{t.pct}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:'#1a1a22', border:'1px solid #252530', borderRadius:'8px', padding:'14px' }}>
                  <div style={{ fontSize:'10px', color:'#555', marginBottom:'12px', fontWeight:600 }}>Recent Calculations</div>
                  {[
                    { sym:'TSLA', entry:'248.10', stop:'244.50', shares:135, risk:'$500' },
                    { sym:'SPY', entry:'548.20', stop:'545.80', shares:208, risk:'$500' },
                    { sym:'QQQ', entry:'472.80', stop:'469.90', shares:172, risk:'$500' },
                    { sym:'AAPL', entry:'211.50', stop:'209.20', shares:217, risk:'$499' },
                  ].map((c, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'50px 70px 70px 60px 50px', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #1e1e26', gap:'6px' }}>
                      <span style={{ fontSize:'11px', fontWeight:700 }}>{c.sym}</span>
                      <span style={{ fontSize:'9px', color:'#555', fontFamily:'monospace' }}>@ {c.entry}</span>
                      <span style={{ fontSize:'9px', color:'#555', fontFamily:'monospace' }}>SL {c.stop}</span>
                      <span style={{ fontSize:'11px', fontWeight:700, color:'#10B981' }}>{c.shares} sh</span>
                      <span style={{ fontSize:'10px', color:'#555', fontFamily:'monospace' }}>{c.risk}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:'rgba(16,185,129,.05)', border:'1px solid rgba(16,185,129,.15)', borderRadius:'8px', padding:'14px' }}>
                  <div style={{ fontSize:'10px', color:'#555', marginBottom:'10px', fontWeight:600 }}>Risk Summary</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    {[
                      { l:'Risk per trade', v:'1.0% / $500' },
                      { l:'Portfolio risk', v:'0.70%' },
                      { l:'Max daily loss', v:'$1,500' },
                      { l:'Buying power used', v:'69.6%' },
                    ].map(m => (
                      <div key={m.l}>
                        <div style={{ fontSize:'8px', color:'#555', marginBottom:'2px' }}>{m.l}</div>
                        <div style={{ fontSize:'12px', fontWeight:700, fontFamily:'monospace', color:'#10B981' }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SLEEK AI SECTION */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section style={{ background: 'linear-gradient(180deg, #08120e 0%, #0a0a0f 100%)', borderTop: '1px solid rgba(16,185,129,.15)', borderBottom: '1px solid rgba(16,185,129,.15)', padding: '100px 48px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="ai-section-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>

            {/* LEFT — Text */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: '20px', padding: '5px 14px', marginBottom: '28px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Sleek AI · Elite Feature
              </div>
              <h2 style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.03em', marginBottom: '20px' }}>
                Ask anything.<br />
                <span style={{ color: '#10B981' }}>It already knows your trades.</span>
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--txt2)', lineHeight: 1.75, marginBottom: '32px', maxWidth: '480px' }}>
                Sleek AI has every trade you've logged, every setup you've tagged, every grade you've given. No copy-pasting, no screenshots, no re-explaining. Ask about your Friday losses — the answer comes from <em>your</em> data, not the internet's.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
                {[
                  { icon: '📊', text: 'Analyzes your win rate by setup, time, and symbol' },
                  { icon: '🧠', text: 'Identifies patterns in your best and worst trades' },
                  { icon: '⚡', text: 'Answers in seconds using your real trading history' },
                  { icon: '🔒', text: 'Your data stays private — never used to train AI models' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '16px', marginTop: '1px' }}>{item.icon}</span>
                    <span style={{ fontSize: '14px', color: 'var(--txt2)', lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link href="/signup" style={{ fontSize: '14px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '10px', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }}>
                  Try Sleek AI free →
                </Link>
                <Link href="/billing" style={{ fontSize: '14px', fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '10px', padding: '12px 20px', textDecoration: 'none', display: 'inline-block' }}>
                  View Elite plan
                </Link>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--txt3)', marginTop: '12px' }}>Included in Elite plan · $29/mo</p>
            </div>

            {/* RIGHT — AI Chat Mock */}
            <div className="ai-mock">
              <div style={{
                background: '#0e0e14',
                border: '1px solid #1e2a20',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 0 0 1px rgba(16,185,129,.08), 0 32px 80px rgba(0,0,0,.6), 0 0 60px rgba(16,185,129,.06)',
              }}>
                {/* Terminal bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0a0a10', borderBottom: '1px solid #1a2218' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444', opacity: 0.7 }} />
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B', opacity: 0.7 }} />
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace', marginLeft: '6px' }}>SLEEK_AI.SH</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                    <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700, letterSpacing: '.06em' }}>LIVE</span>
                  </div>
                </div>

                {/* Chat body */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Intro line */}
                  <div style={{ fontSize: '12px', color: '#555', textAlign: 'center', padding: '4px 0' }}>Ask me anything about your trading.</div>

                  {/* Suggested question pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      'Why do I keep losing on Fridays?',
                      'What\'s my best-performing setup?',
                      'When did I break my risk rules last month?',
                      'What\'s my win rate after a 9 AM loss?',
                    ].map((q, i) => (
                      <div key={i} style={{ background: '#131320', border: '1px solid #1e2030', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#9999AA', cursor: 'pointer' }}>
                        {q}
                      </div>
                    ))}
                  </div>

                  {/* User message */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: '13px', color: '#D1FAE5', maxWidth: '85%' }}>
                      Why do I keep losing on Fridays?
                    </div>
                  </div>

                  {/* AI response */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#062e21', border: '1px solid rgba(16,185,129,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    </div>
                    <div style={{ background: '#131320', border: '1px solid #1e2030', borderRadius: '2px 12px 12px 12px', padding: '12px 14px', fontSize: '13px', color: '#C8C8D8', lineHeight: 1.65, flex: 1 }}>
                      <p style={{ margin: '0 0 10px' }}>Based on your last <span style={{ color: '#10B981', fontWeight: 700 }}>142 trades</span>, Fridays are your weakest day — <span style={{ color: '#EF4444', fontWeight: 700 }}>-$1,240 avg P&L</span> vs +$890 on Tuesdays.</p>
                      <p style={{ margin: '0 0 10px' }}>The pattern: you take <span style={{ color: '#F59E0B', fontWeight: 600 }}>2.3× more trades</span> on Fridays but your win rate drops to <span style={{ color: '#EF4444', fontWeight: 700 }}>38%</span> vs your normal 71%. Most losses happen after <span style={{ color: '#F59E0B', fontWeight: 600 }}>2 PM ET</span>.</p>
                      <div style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', borderRadius: '8px', padding: '10px 12px', marginTop: '10px' }}>
                        <div style={{ fontSize: '10px', color: '#10B981', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>💡 Suggestion</div>
                        <div style={{ fontSize: '12px', color: '#9999AA', lineHeight: 1.55 }}>Stop trading Fridays after 2 PM ET. That single rule would have saved you <span style={{ color: '#10B981', fontWeight: 700 }}>+$3,840</span> over the last 3 months.</div>
                      </div>
                    </div>
                  </div>

                  {/* Input bar */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ flex: 1, background: '#0a0a10', border: '1px solid #1e2030', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#555' }}>
                      Ask Sleek AI anything about your trades...
                    </div>
                    <div style={{ width: '34px', height: '34px', background: '#10B981', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '16px' }}>
                {[
                  { l: 'Trades analyzed', v: '142', c: '#fff' },
                  { l: 'Best day', v: 'Tuesday', c: '#10B981' },
                  { l: 'Friday P&L', v: '-$1,240', c: '#EF4444' },
                ].map(m => (
                  <div key={m.l} style={{ background: '#0e0e14', border: '1px solid #1e2028', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.l}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: m.c, fontFamily: 'monospace' }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" style={{ background:'var(--bg2)', borderTop:'1px solid var(--brd)', borderBottom:'1px solid var(--brd)', padding:'80px 48px' }} className="section-pad">
        <div style={{ maxWidth:'900px', margin:'0 auto', textAlign:'center' }}>
          <h2 className="section-h2" style={{ fontSize:'36px', fontWeight:800, letterSpacing:'-.02em', marginBottom:'16px' }}>Built for anyone serious about their edge</h2>
          <p style={{ fontSize:'16px', color:'var(--txt2)', lineHeight:1.7, marginBottom:'40px' }}>
            Whether you scalp momentum plays, swing trade setups, trade Nasdaq futures, or invest long-term — Sleektrade gives you the data to understand your own performance with precision.
          </p>
          <div className="who-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
            {[
              { label:'Day traders', desc:'Track intraday scalps with hold-time accuracy down to the minute.' },
              { label:'Swing traders', desc:'Review multi-day positions and identify your best setups over time.' },
              { label:'Futures traders', desc:'Log NQ, ES, MNQ and more. Works with NinjaTrader, TradeStation & more.' },
              { label:'Investors', desc:'Track long-term positions, monitor performance, and review your decisions.' },
            ].map(item => (
              <div key={item.label} style={{ background:'var(--bg3)', border:'1px solid var(--brd)', borderRadius:'10px', padding:'22px' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#10B981', marginBottom:'8px' }}>{item.label}</div>
                <div style={{ fontSize:'13px', color:'var(--txt2)', lineHeight:1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <Testimonials />

      {/* PRICING */}
      <PricingSection />

      {/* FINAL CTA */}
      <section style={{ textAlign:'center', padding:'80px 24px', borderTop:'1px solid var(--brd)', background:'var(--bg2)' }}>
        <h2 className="cta-h2" style={{ fontSize:'38px', fontWeight:800, letterSpacing:'-.02em', marginBottom:'16px' }}>Stop guessing. Start knowing.</h2>
        <p style={{ fontSize:'16px', color:'var(--txt2)', marginBottom:'32px' }}>Join traders and investors who use Sleektrade to understand their performance and trade with confidence.</p>
        <Link href="/signup" style={{ fontSize:'15px', fontWeight:700, color:'#000', background:'#10B981', borderRadius:'10px', padding:'15px 36px', textDecoration:'none', display:'inline-block' }}>Create your free account</Link>
        <p style={{ fontSize:'12px', color:'var(--txt3)', marginTop:'14px' }}>No credit card required · Cancel anytime</p>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:'1px solid var(--brd)', padding:'32px 48px' }}>
        <div className="footer-flex" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <SmallLogo />
            <span style={{ fontSize:'12px', color:'var(--txt3)' }}>© 2026 Sleektrade. All rights reserved.</span>
          </div>
          <div className="footer-links" style={{ display:'flex', gap:'20px', fontSize:'12px' }}>
            <a href="#features" style={{ color:'var(--txt3)', textDecoration:'none' }}>Features</a>
            <a href="#pricing" style={{ color:'var(--txt3)', textDecoration:'none' }}>Pricing</a>
            <Link href="/contact" style={{ color:'var(--txt3)', textDecoration:'none' }}>Contact</Link>
            <Link href="/privacy" style={{ color:'var(--txt3)', textDecoration:'none' }}>Privacy</Link>
            <Link href="/terms" style={{ color:'var(--txt3)', textDecoration:'none' }}>Terms</Link>
            <Link href="/login" style={{ color:'var(--txt3)', textDecoration:'none' }}>Log in</Link>
            <Link href="/signup" style={{ color:'var(--txt3)', textDecoration:'none' }}>Sign up</Link>
          </div>
          <div className="footer-social" style={{ display:'flex', gap:'8px' }}>
            <a href="https://x.com/sleektrade" target="_blank" rel="noopener noreferrer" className="footer-social-icon" title="X (Twitter)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://youtube.com/@sleektrade" target="_blank" rel="noopener noreferrer" className="footer-social-icon" title="YouTube">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
            <a href="https://instagram.com/sleektrade" target="_blank" rel="noopener noreferrer" className="footer-social-icon" title="Instagram">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            </a>
            <a href="https://tiktok.com/@sleektrade" target="_blank" rel="noopener noreferrer" className="footer-social-icon" title="TikTok">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>
            </a>
          </div>
        </div>
      </footer>

      {/* AI CHAT BOT */}
      <SleektradeChat />

    </div>
  )
}
