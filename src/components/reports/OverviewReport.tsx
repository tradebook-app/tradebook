['Avg daily volume', dayE.length ? (totalVol / dayE.length).toFixed(1) : '0'],
        ['Recovery factor', recovery],
      ]

  const StatCol = ({ rows, borderRight }: { rows: [string, string][]; borderRight?: boolean }) => (
    <div style={{ borderRight: borderRight ? '1px solid var(--brd)' : 'none' }}>
      {rows.map(([n, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--brd)', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--txt2)', flexShrink: 0 }}>{n}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--txt)', textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  )

  if (closed.length === 0) {
    return <div style={{ padding: '30px', textAlign: 'center', color: 'var(--txt3)', fontSize: '12px' }}>No closed trades yet.</div>
  }

  return (
    <div>
      <div style={{ background: 'var(--bg4, #16161e)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px 18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>Your Stats</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {([
            ['Day',   bestDay,             worstDay],
            ['Week',  bestWeek,            worstWeek],
            ['Month', bestMo[1] as number, worstMo[1] as number],
          ] as [string, number, number][]).map(([period, b, w], i, arr) => (
            <div
              key={period}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--brd)' : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '3px' }}>Best {period}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: b >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtK(b)}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '3px' }}>Worst {period}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: w >= 0 ? 'var(--ac)' : 'var(--red)' }}>{fmtK(w)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <StatCol rows={left} borderRight />
        <StatCol rows={right} />
      </div>
    </div>
  )
}