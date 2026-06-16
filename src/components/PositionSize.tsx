'use client'

import { useState, useMemo } from 'react'

export function PositionSize() {
  const [account,   setAccount]   = useState('100000')
  const [riskPct,   setRiskPct]   = useState('1')
  const [entry,     setEntry]     = useState('')
  const [stop,      setStop]      = useState('')
  const [side,      setSide]      = useState<'Long' | 'Short'>('Long')

  const calc = useMemo(() => {
    const acc  = parseFloat(account) || 0
    const risk = parseFloat(riskPct) || 0
    const en   = parseFloat(entry)   || 0
    const st   = parseFloat(stop)    || 0

    if (!acc || !risk || !en || !st) return null

    const riskAmt   = acc * (risk / 100)
    const stopDist  = Math.abs(en - st)
    if (stopDist === 0) return null

    const shares    = Math.floor(riskAmt / stopDist)
    const posSize   = shares * en
    const maxLoss   = shares * stopDist
    const pctOfAcct = (posSize / acc) * 100

    // R-multiple targets
    const targets = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(r => {
      const pnl    = r * riskAmt
      const price  = side === 'Long'
        ? en + pnl / shares
        : en - pnl / shares
      return { r, pnl, price }
    })

    return { riskAmt, stopDist, shares, posSize, maxLoss, pctOfAcct, targets }
  }, [account, riskPct, entry, stop, side])

  const lbl = (text: string) => (
    <label style={{
      display: 'block', fontSize: '9px', fontWeight: 600,
      color: 'var(--txt3)', textTransform: 'uppercase',
      letterSpacing: '.06em', marginBottom: '4px',
    }}>{text}</label>
  )

  const statRow = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid var(--brd)' }}>
      <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--txt)' }}>{value}</span>
    </div>
  )

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Position Size Calculator</div>
        <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>
          Calculate your exact share size based on account risk. Never risk more than you plan to.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px' }}>

        {/* Input panel */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Side toggle */}
          <div>
            {lbl('Side')}
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['Long', 'Short'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 'var(--r)',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--sans)', border: 'none',
                    background: side === s
                      ? s === 'Long' ? 'var(--ac)' : 'var(--red)'
                      : 'var(--bg4)',
                    color: side === s ? (s === 'Long' ? '#000' : '#fff') : 'var(--txt3)',
                    transition: '.15s',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Account size */}
          <div>
            {lbl('Account Size ($)')}
            <input
              className="fi"
              type="number"
              value={account}
              onChange={e => setAccount(e.target.value)}
              placeholder="100000"
              style={{ fontFamily: 'var(--mono)' }}
            />
          </div>

          {/* Risk % */}
          <div>
            {lbl('Risk per Trade (%)')}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              {['0.5', '1', '1.5', '2'].map(v => (
                <button
                  key={v}
                  onClick={() => setRiskPct(v)}
                  style={{
                    flex: 1, padding: '5px', borderRadius: 'var(--r)',
                    fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--sans)',
                    background: riskPct === v ? 'var(--ac-d)' : 'var(--bg4)',
                    color: riskPct === v ? 'var(--ac2)' : 'var(--txt3)',
                    border: '1px solid ' + (riskPct === v ? 'var(--ac)' : 'var(--brd2)'),
                  }}
                >{v}%</button>
              ))}
            </div>
            <input
              className="fi"
              type="number"
              value={riskPct}
              onChange={e => setRiskPct(e.target.value)}
              placeholder="1"
              style={{ fontFamily: 'var(--mono)' }}
            />
          </div>

          {/* Entry price */}
          <div>
            {lbl('Entry Price ($)')}
            <input
              className="fi"
              type="number"
              value={entry}
              onChange={e => setEntry(e.target.value)}
              placeholder="0.00"
              style={{ fontFamily: 'var(--mono)' }}
            />
          </div>

          {/* Stop loss */}
          <div>
            {lbl(`Stop Loss ($) — ${side === 'Long' ? 'below entry' : 'above entry'}`)}
            <input
              className="fi"
              type="number"
              value={stop}
              onChange={e => setStop(e.target.value)}
              placeholder="0.00"
              style={{ fontFamily: 'var(--mono)' }}
            />
          </div>

          {/* Risk amount preview */}
          {account && riskPct && (
            <div style={{
              background: 'var(--bg4)', borderRadius: 'var(--r)',
              padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>Max Risk Amount</span>
              <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--red)' }}>
                ${((parseFloat(account) || 0) * ((parseFloat(riskPct) || 0) / 100)).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Results panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {!calc ? (
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--brd)',
              borderRadius: 'var(--r2)', padding: '40px',
              textAlign: 'center', color: 'var(--txt3)', fontSize: '11px',
            }}>
              Fill in all fields to calculate position size
            </div>
          ) : (
            <>
              {/* Main result */}
              <div style={{
                background: 'var(--bg3)', border: '1px solid var(--brd)',
                borderRadius: 'var(--r2)', overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
                  Position Sizing Result
                </div>
                <div style={{
                  padding: '20px 18px', textAlign: 'center',
                  borderBottom: '1px solid var(--brd)',
                  background: 'var(--bg4)',
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Shares to Buy</div>
                  <div style={{ fontSize: '48px', fontWeight: 900, fontFamily: 'var(--mono)', color: side === 'Long' ? 'var(--ac)' : 'var(--red)', lineHeight: 1 }}>
                    {calc.shares.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '6px' }}>shares</div>
                </div>
                {statRow('Risk Amount (1R)',  `$${calc.riskAmt.toFixed(2)}`,   'var(--red)')}
                {statRow('Stop Distance',     `$${calc.stopDist.toFixed(4)}`,  'var(--txt)')}
                {statRow('Position Size',     `$${calc.posSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'var(--txt)')}
                {statRow('Max Loss',          `-$${calc.maxLoss.toFixed(2)}`,  'var(--red)')}
                {statRow('% of Account',      `${calc.pctOfAcct.toFixed(1)}%`, calc.pctOfAcct > 20 ? 'var(--red)' : 'var(--txt)')}
              </div>

              {/* R-Multiple targets */}
              <div style={{
                background: 'var(--bg3)', border: '1px solid var(--brd)',
                borderRadius: 'var(--r2)', overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>
                  Profit Targets
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['R-Multiple', 'Target Price', 'Profit ($)', 'ROI'].map(h => (
                        <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 16px', textAlign: 'left', borderBottom: '1px solid var(--brd)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calc.targets.map((t, i) => {
                      const roi = (t.pnl / calc.posSize) * 100
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)' }}>
                          <td style={{ padding: '8px 16px', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ac2)', borderBottom: '1px solid var(--brd)', fontSize: '12px' }}>
                            {t.r}R
                          </td>
                          <td style={{ padding: '8px 16px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)', fontSize: '12px' }}>
                            ${t.price.toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 16px', fontFamily: 'var(--mono)', color: 'var(--ac)', fontWeight: 600, borderBottom: '1px solid var(--brd)', fontSize: '12px' }}>
                            +${t.pnl.toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 16px', fontFamily: 'var(--mono)', color: 'var(--ac)', borderBottom: '1px solid var(--brd)', fontSize: '11px' }}>
                            +{roi.toFixed(2)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
