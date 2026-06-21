export function Testimonials() {
  const testimonials = [
    {
      name: 'Marcus T.',
      role: 'Day Trader · 4 years',
      avatar: 'MT',
      color: '#10B981',
      text: 'Finally a journal that shows me EXACTLY which setups are making me money and which ones are killing my account. The Day & Time report alone changed how I trade.',
      stars: 5,
    },
    {
      name: 'Sarah K.',
      role: 'Swing Trader · 6 years',
      avatar: 'SK',
      color: '#6366f1',
      text: 'I used to track everything in spreadsheets. Sleektrade replaced 3 different tools for me. The symbol reports help me see which stocks I actually have an edge on.',
      stars: 5,
    },
    {
      name: 'James R.',
      role: 'Long-term Investor · 8 years',
      avatar: 'JR',
      color: '#f59e0b',
      text: 'I track my position entries and exits across multiple accounts. The overview metrics give me a clear picture of my portfolio performance without any spreadsheet math.',
      stars: 5,
    },
    {
      name: 'David L.',
      role: 'NQ Futures Trader · 3 years',
      avatar: 'DL',
      color: '#ef4444',
      text: 'The R-multiple tracking is exactly what I needed. I can see my average win is 2.8R and now I know why my account keeps growing even with a 40% win rate.',
      stars: 5,
    },
    {
      name: 'Priya M.',
      role: 'Momentum Trader · 2 years',
      avatar: 'PM',
      color: '#10B981',
      text: 'Imported my TOS trades in 2 minutes. The duplicate detection is smart — it didn\'t double-count anything. The UI is the cleanest I\'ve seen in any trading tool.',
      stars: 5,
    },
    {
      name: 'Alex W.',
      role: 'Investor & Swing Trader · 5 years',
      avatar: 'AW',
      color: '#6366f1',
      text: 'The notebook feature helps me write down my trade thesis before entering. When I review losing trades, I can see exactly where my thinking went wrong.',
      stars: 5,
    },
  ]

  return (
    <section style={{ padding: '80px 48px', borderTop: '1px solid var(--brd)' }} className="section-pad">
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h2 className="section-h2" style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '12px' }}>
            Traders love Sleektrade
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--txt2)' }}>
            From day traders to long-term investors — real feedback from real users.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="testimonials-grid">
          {testimonials.map((t, i) => (
            <div key={i} style={{
              background: 'var(--bg2)', border: '1px solid var(--brd)',
              borderRadius: '14px', padding: '24px',
              display: 'flex', flexDirection: 'column', gap: '16px',
            }}>
              {/* Stars */}
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: t.stars }).map((_, j) => (
                  <span key={j} style={{ color: '#f59e0b', fontSize: '13px' }}>★</span>
                ))}
              </div>

              {/* Quote */}
              <p style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.7, flex: 1, margin: 0 }}>
                "{t.text}"
              </p>

              {/* Author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: `${t.color}22`, border: `1px solid ${t.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 800, color: t.color, flexShrink: 0,
                }}>
                  {t.avatar}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)' }}>{t.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .testimonials-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 640px) { .testimonials-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  )
}
