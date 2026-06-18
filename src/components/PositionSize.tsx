'use client'

import { useState, useMemo } from 'react'

const R_TARGETS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50]

export function PositionSize() {
  const [account, setAccount] = useState('')
  const [riskPct, setRiskPct] = useState('0.5')
  const [maxPct,  setMaxPct]  = useState('')
  const [entry,   setEntry]   = useState('')
  const [stop,    setStop]    = useState('')
  const [side,    setSide]    = useState<'Long' | 'Short'>('Long')

  const c = useMemo(() => {
    const acc = parseFloat(account) || 0
    const rp  = parseFloat(riskPct) || 0
    const mp  = parseFloat(maxPct)  || 0
    const en  = parseFloat(entry)   || 0
    const st  = parseFloat(stop)    || 0

    const dR   = acc * rp / 100
    const maxD = acc * mp / 100
    const sd   = Math.abs(en - st)
    let sh = sd > 0 ? Math.floor(dR / sd) : 0
    if (maxD > 0 && en > 0) sh = Math.min(sh, Math.floor(maxD / en))
    const pv = sh * en
    const pa = acc > 0 ? pv / acc * 100 : 0

    const targets = R_TARGETS.map(r => {
      const tgt = side === 'Long' ? en + sd * r : en - sd * r
      return { r, tgt, profit: dR * r, pctAcc: acc > 0 ? dR * r / acc * 100 : 0 }
    })

    return { acc, dR, maxD, sd, sh, pv, pa, targets }
  }, [account, riskPct, maxPct, entry, stop, side])

  // derived dollar displays for the linked inputs
  const acc = parseFloat(account) || 0
  const riskDollar = acc > 0 && riskPct ? (acc * (parseFloat(riskPct) || 0) / 100).toFixed(2) : ''
  const maxDollar  = acc > 0 && maxPct  ? (acc * (parseFloat(maxPct)  || 0) / 100).toFixed(0) : ''

  const lbl: React.CSSProperties = { display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }
  const affix: React.CSSProperties = { background: 'var(--bg4, #16161e)', border: '1px solid var(--brd2, #2a2a35)', padding: '8px 10px', fontSize: '11px', color: 'var(--txt3)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center' }
  const dot = (color: string) => <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block', marginRight: '7px' }} />

  const resRow = (label: string, value: string, color?: string, bold?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--brd)' }}>
      <span style={{ fontSize: '12px', color: 'var(--txt2)' }}>{label}</span>
      <span style={{ fontSize: bold ? '16px' : '13px', fontWeight: bold ? 900 : 700, fontFamily: 'var(--mono)', color: color || 'var(--ac)' }}>{value}</span>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>

      {/* LEFT: Calculator */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 700, marginBottom: '18px' }}>
          {dot('var(--ac)')}Position Size Calculator
        </div>

        {/* Side toggle */}
        <div style={{ marginBottom: '14px' }}>
          <span style={lbl}>Side</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['Long', 'Short'] as const).map(s => (
              <button key={s} onClick={() => setSide(s)} style={{
                flex: 1, padding: '8px', borderRadius: 'var(--r)', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--sans)', border: 'none',
                background: side === s ? (s === 'Long' ? 'var(--ac)' : 'var(--red)') : 'var(--bg4, #16161e)',
                color: side === s ? (s === 'Long' ? '#000' : '#fff') : 'var(--txt3)',
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Account size */}
        <div style={{ marginBottom: '14px' }}>
          <span style={lbl}>Account Size</span>
          <div style={{ display: 'flex' }}>
            <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
            <input className="fi" type="number" value={account} onChange={e => setAccount(e.target.value)}
              placeholder="100000" style={{ fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
          </div>
        </div>

        {/* Equity at risk per position */}
        <div style={{ marginBottom: '14px' }}>
          <span style={lbl}>Equity at Risk Per Position</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
              <input className="fi" type="number" value={riskDollar}
                onChange={e => setRiskPct(acc > 0 ? String((parseFloat(e.target.value) || 0) / acc * 100) : '0')}
                placeholder="150" style={{ fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
            </div>
            <div style={{ display: 'flex' }}>
              <input className="fi" type="number" value={riskPct} step="0.1"
                onChange={e => setRiskPct(e.target.value)}
                style={{ fontFamily: 'var(--mono)', borderRadius: 'var(--r) 0 0 var(--r)' }} />
              <span style={{ ...affix, borderLeft: 0, borderRadius: '0 var(--r) var(--r) 0' }}>%</span>
            </div>
          </div>
        </div>

        {/* Max position size */}
        <div style={{ marginBottom: '14px' }}>
          <span style={lbl}>Max Position Size Allowed</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
              <input className="fi" type="number" value={maxDollar}
                onChange={e => setMaxPct(acc > 0 ? String((parseFloat(e.target.value) || 0) / acc * 100) : '0')}
                placeholder="e.g. 10000" style={{ fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
            </div>
            <div style={{ display: 'flex' }}>
              <input className="fi" type="number" value={maxPct}
                onChange={e => setMaxPct(e.target.value)}
                placeholder="e.g. 30" style={{ fontFamily: 'var(--mono)', borderRadius: 'var(--r) 0 0 var(--r)' }} />
              <span style={{ ...affix, borderLeft: 0, borderRadius: '0 var(--r) var(--r) 0' }}>%</span>
            </div>
          </div>
          <div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '5px' }}>Swing trading: typically 25–35% of account</div>
        </div>

        {/* Entry price */}
        <div style={{ marginBottom: '14px' }}>
          <span style={lbl}>Entry Price</span>
          <div style={{ display: 'flex' }}>
            <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
            <input className="fi" type="number" value={entry} onChange={e => setEntry(e.target.value)}
              placeholder="0.00" style={{ fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
          </div>
        </div>

        {/* Stop loss */}
        <div style={{ marginBottom: '18px' }}>
          <span style={lbl}>Stop Loss</span>
          <div style={{ display: 'flex' }}>
            <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
            <input className="fi" type="number" value={stop} onChange={e => setStop(e.target.value)}
              placeholder="0.00" style={{ fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
          </div>
        </div>

        {/* Results */}
        <div>
          {resRow('Dollar Risk', `$${c.dR.toFixed(2)}`, 'var(--ac)')}
          {resRow('Shares', c.sh.toLocaleString(), 'var(--ac)', true)}
          {resRow('Position Value', `$${c.pv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'var(--ac)')}
          {resRow('% of Account', `${c.pa.toFixed(2)}%`, c.pa > (parseFloat(maxPct) || 100) ? 'var(--red)' : 'var(--ac)')}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0' }}>
            <span style={{ fontSize: '12px', color: 'var(--txt2)' }}>Stop Distance</span>
            <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ac)' }}>${c.sd.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* RIGHT: R-Multiple Targets */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
          {dot('var(--ac)')}R-Multiple Targets
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['R', 'Target Price', 'Profit', '% Account'].map((h, i) => (
                <th key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '9px 10px', textAlign: i === 0 ? 'left' : 'right', borderBottom: '1px solid var(--brd2, #2a2a35)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.targets.map(t => (
              <tr key={t.r}>
                <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--txt2)', fontSize: '12px', borderBottom: '1px solid var(--brd)' }}>{t.r}R</td>
                <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid var(--brd)', color: 'var(--txt)' }}>${t.tgt.toFixed(2)}</td>
                <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid var(--brd)', color: 'var(--ac)', fontWeight: 600 }}>+${t.profit.toFixed(2)}</td>
                <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid var(--brd)', color: 'var(--txt3)' }}>{c.acc > 0 ? `${t.pctAcc.toFixed(2)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
