'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { futuresPointValue, futuresTickSize, FUTURES_CONTRACTS } from '@/lib/contractMultiplier'
import {
  loadPositionSizePrefs, savePositionSizePrefs,
  STOCK_DEFAULTS, FUTURES_DEFAULTS,
} from '@/lib/positionSizePrefs'

const R_TARGETS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50]
const SIZE_LEVEL_PCTS = [0.25, 0.5, 1, 1.5, 2, 3]
const FUT_CATEGORIES = Array.from(new Set(FUTURES_CONTRACTS.map(c => c.category)))

export function PositionSize() {
  const [mode, setMode] = useState<'stocks' | 'futures'>('stocks')

  const [account, setAccount] = useState('')
  const [riskPct, setRiskPct] = useState('')
  const [riskDollarStr, setRiskDollarStr] = useState('')
  const [maxPct,  setMaxPct]  = useState('')
  const [maxDollarStr, setMaxDollarStr] = useState('')
  const [entry,   setEntry]   = useState('')
  const [stop,    setStop]    = useState('')
  const [side,    setSide]    = useState<'Long' | 'Short'>('Long')

  function handleRiskDollarChange(v: string) {
    setRiskDollarStr(v)
    const acc = parseFloat(account) || 0
    setRiskPct(acc > 0 ? String((parseFloat(v) || 0) / acc * 100) : '0')
  }
  function handleRiskPctChange(v: string) {
    setRiskPct(v)
    const acc = parseFloat(account) || 0
    setRiskDollarStr(acc > 0 && v ? (acc * (parseFloat(v) || 0) / 100).toFixed(2) : '')
  }
  function handleMaxDollarChange(v: string) {
    setMaxDollarStr(v)
    const acc = parseFloat(account) || 0
    setMaxPct(acc > 0 ? String((parseFloat(v) || 0) / acc * 100) : '0')
  }
  function handleMaxPctChange(v: string) {
    setMaxPct(v)
    const acc = parseFloat(account) || 0
    setMaxDollarStr(acc > 0 && v ? (acc * (parseFloat(v) || 0) / 100).toFixed(0) : '')
  }

  useEffect(() => {
    const acc = parseFloat(account) || 0
    if (riskPct) setRiskDollarStr(acc > 0 ? (acc * (parseFloat(riskPct) || 0) / 100).toFixed(2) : '')
    if (maxPct)  setMaxDollarStr(acc > 0 ? (acc * (parseFloat(maxPct)  || 0) / 100).toFixed(0) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  const c = useMemo(() => {
    const acc = parseFloat(account) || 0
    const rp  = parseFloat(riskPct) || 0
    const mp  = parseFloat(maxPct)  || 0
    const en  = parseFloat(entry)   || 0
    const st  = parseFloat(stop)    || 0

    const dR   = acc * rp / 100
    const maxD = acc * mp / 100
    const sd   = Math.abs(en - st)
    const sdPct = en > 0 ? sd / en * 100 : 0
    const riskShares = sd > 0 ? Math.floor(dR / sd) : 0
    let sh = riskShares
    let capped = false
    if (maxD > 0 && en > 0) {
      const maxSh = Math.floor(maxD / en)
      if (maxSh < sh) { sh = maxSh; capped = true }
    }
    const pv = sh * en
    const pa = acc > 0 ? pv / acc * 100 : 0
    const actualRisk = sh * sd

    const targets = R_TARGETS.map(r => {
      const tgt = side === 'Long' ? en + sd * r : en - sd * r
      return { r, tgt, profit: actualRisk * r, pctAcc: acc > 0 ? actualRisk * r / acc * 100 : 0 }
    })

    return { acc, dR, actualRisk, capped, maxD, sd, sdPct, sh, pv, pa, targets }
  }, [account, riskPct, maxPct, entry, stop, side])

  const [futAccount, setFutAccount] = useState('')
  const [futRiskMode, setFutRiskMode] = useState<'pct' | 'fixed'>('pct')
  const [futRiskInput, setFutRiskInput] = useState('')
  const [futSymbol, setFutSymbol] = useState('ES')
  const [futStopInput, setFutStopInput] = useState('')
  const [futTakeProfitInput, setFutTakeProfitInput] = useState('')
  const [futStopUnit, setFutStopUnit] = useState<'points' | 'ticks'>('points')
  const [contractOpen, setContractOpen] = useState(false)
  const contractRef = useRef<HTMLDivElement>(null)

  // ── Persisted settings ─────────────────────────────────────────────────────
  // Restore on mount (an effect, not a lazy useState initializer: AppProvider
  // server-renders this component, so reading localStorage during render would
  // hydrate-mismatch). Only settings fields are stored -- entry, stop, and take
  // profit are per-trade and always start blank.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    const p = loadPositionSizePrefs()
    setMode(p.mode)

    setAccount(p.stocks.account)
    setRiskPct(p.stocks.riskPct)
    setMaxPct(p.stocks.maxPct)
    setSide(p.stocks.side)
    // Rebuild the $ mirrors from the restored account + %s.
    const acc = parseFloat(p.stocks.account) || 0
    setRiskDollarStr(acc > 0 && p.stocks.riskPct ? (acc * (parseFloat(p.stocks.riskPct) || 0) / 100).toFixed(2) : '')
    setMaxDollarStr(acc > 0 && p.stocks.maxPct ? (acc * (parseFloat(p.stocks.maxPct) || 0) / 100).toFixed(0) : '')

    setFutAccount(p.futures.futAccount)
    setFutRiskMode(p.futures.futRiskMode)
    setFutRiskInput(p.futures.futRiskInput)
    setFutSymbol(p.futures.futSymbol)
    setFutStopUnit(p.futures.futStopUnit)

    setHydrated(true)
  }, [])

  // Persist on change -- but only once the restore effect above has run and its
  // state updates have committed, so we never save the pre-restore defaults
  // over a real saved blob.
  useEffect(() => {
    if (!hydrated) return
    savePositionSizePrefs({
      mode,
      stocks: { account, riskPct, maxPct, side },
      futures: { futAccount, futRiskMode, futRiskInput, futSymbol, futStopUnit },
    })
  }, [hydrated, mode, account, riskPct, maxPct, side, futAccount, futRiskMode, futRiskInput, futSymbol, futStopUnit])

  function clearStocks() {
    setAccount(STOCK_DEFAULTS.account)
    setRiskPct(STOCK_DEFAULTS.riskPct)
    setRiskDollarStr('')
    setMaxPct(STOCK_DEFAULTS.maxPct)
    setMaxDollarStr('')
    setEntry('')
    setStop('')
    setSide(STOCK_DEFAULTS.side)
  }

  function clearFutures() {
    setFutAccount(FUTURES_DEFAULTS.futAccount)
    setFutRiskMode(FUTURES_DEFAULTS.futRiskMode)
    setFutRiskInput(FUTURES_DEFAULTS.futRiskInput)
    setFutSymbol(FUTURES_DEFAULTS.futSymbol)
    setFutStopInput('')
    setFutTakeProfitInput('')
    setFutStopUnit(FUTURES_DEFAULTS.futStopUnit)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contractRef.current && !contractRef.current.contains(e.target as Node)) {
        setContractOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const futContractInfo = FUTURES_CONTRACTS.find(fc => fc.symbol === futSymbol)

  const fc = useMemo(() => {
    const acc     = parseFloat(futAccount) || 0
    const riskRaw = parseFloat(futRiskInput) || 0
    const stopRaw = parseFloat(futStopInput) || 0
    const tpRaw   = parseFloat(futTakeProfitInput) || 0

    const pvLookup  = futuresPointValue(futSymbol)
    const pv        = pvLookup ?? 0
    const pvUnknown = pvLookup === null

    const tickSize = futuresTickSize(futSymbol) ?? 1
    const stopPts  = futStopUnit === 'ticks' ? stopRaw * tickSize : stopRaw
    const tpPts    = futStopUnit === 'ticks' ? tpRaw   * tickSize : tpRaw

    const riskDollars = futRiskMode === 'fixed' ? riskRaw : acc * riskRaw / 100
    const riskPct = acc > 0 ? riskDollars / acc * 100 : 0

    const riskPerContract = stopPts * pv
    const contracts   = riskPerContract > 0 ? Math.floor(riskDollars / riskPerContract) : 0
    const actualRisk  = contracts * riskPerContract
    const rr = (tpPts > 0 && stopPts > 0) ? tpPts / stopPts : null

    const sizeLevels = SIZE_LEVEL_PCTS.map(lvl => {
      const dollars = acc * lvl / 100
      const n = riskPerContract > 0 ? Math.floor(dollars / riskPerContract) : 0
      return { lvl, dollars, contracts: n }
    })

    const targets = R_TARGETS.map(r => ({
      r,
      pointsAway: stopPts * r,
      profit: actualRisk * r,
    }))

    return { acc, riskDollars, riskPct, riskPerContract, contracts, actualRisk, rr, pv, pvUnknown, stopPts, tpPts, sizeLevels, targets }
  }, [futAccount, futRiskMode, futRiskInput, futSymbol, futStopInput, futTakeProfitInput, futStopUnit])

  const lbl: React.CSSProperties = { display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }
  const affix: React.CSSProperties = { background: 'var(--bg4, #16161e)', border: '1px solid var(--brd2, #2a2a35)', padding: '0 10px', height: '28px', fontSize: '11px', color: 'var(--txt)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center' }
  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '20px' }
  const dot = (color: string) => <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block', marginRight: '7px' }} />

  const cardHeader = (title: string, onClear: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
      <span style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 700 }}>{dot('var(--ac)')}{title}</span>
      <button type="button" onClick={onClear} className="btn btn-o" style={{ flexShrink: 0 }}>Clear All</button>
    </div>
  )

  // Result-row vertical padding: tightened from 11px to 8px so the added
  // "Stop Distance %" row fits without growing the calculator card.
  const resRow = (label: string, value: string, color?: string, bold?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--brd)' }}>
      <span style={{ fontSize: '12px', color: 'var(--txt2)' }}>{label}</span>
      <span style={{ fontSize: bold ? '16px' : '13px', fontWeight: bold ? 900 : 700, fontFamily: 'var(--mono)', color: color || 'var(--ac)' }}>{value}</span>
    </div>
  )

  const statCard = (label: string, value: string, sub: string, color?: string) => (
    <div style={card}>
      <div style={{ fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--txt)', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>{sub}</div>
    </div>
  )

  const toggleBtn = (active: boolean, onClick: () => void, label: string, activeColor = 'var(--ac)', activeText = '#000') => (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px', borderRadius: 'var(--r)', fontSize: '12px', fontWeight: 700,
      cursor: 'pointer', fontFamily: 'var(--sans)', border: 'none',
      background: active ? activeColor : 'var(--bg4, #16161e)',
      color: active ? activeText : 'var(--txt2)',
    }}>{label}</button>
  )

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <span style={lbl}>Asset Type</span>
        <div style={{ display: 'flex', gap: '6px', maxWidth: '260px' }}>
          {toggleBtn(mode === 'stocks', () => setMode('stocks'), 'Stocks')}
          {toggleBtn(mode === 'futures', () => setMode('futures'), 'Futures')}
        </div>
      </div>

      {mode === 'stocks' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'stretch' }}>
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '20px' }}>
            {cardHeader('Position Size Calculator', clearStocks)}

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

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Account Size</span>
              <div style={{ display: 'flex' }}>
                <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
                <input className="fi" type="number" value={account} onChange={e => setAccount(e.target.value)}
                  style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Equity at Risk Per Position</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ display: 'flex' }}>
                  <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
                  <input className="fi" type="number" value={riskDollarStr}
                    onChange={e => handleRiskDollarChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
                </div>
                <div style={{ display: 'flex' }}>
                  <input className="fi" type="number" value={riskPct} step="0.1"
                    onChange={e => handleRiskPctChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', borderRadius: 'var(--r) 0 0 var(--r)' }} />
                  <span style={{ ...affix, borderLeft: 0, borderRadius: '0 var(--r) var(--r) 0' }}>%</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Max Position Size Allowed</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ display: 'flex' }}>
                  <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
                  <input className="fi" type="number" value={maxDollarStr}
                    onChange={e => handleMaxDollarChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
                </div>
                <div style={{ display: 'flex' }}>
                  <input className="fi" type="number" value={maxPct}
                    onChange={e => handleMaxPctChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', borderRadius: 'var(--r) 0 0 var(--r)' }} />
                  <span style={{ ...affix, borderLeft: 0, borderRadius: '0 var(--r) var(--r) 0' }}>%</span>
                </div>
              </div>
              <div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '5px' }}>Swing trading: typically 25–35% of account</div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Entry Price</span>
              <div style={{ display: 'flex' }}>
                <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
                <input className="fi" type="number" value={entry} onChange={e => setEntry(e.target.value)}
                  style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <span style={lbl}>Stop Loss</span>
              <div style={{ display: 'flex' }}>
                <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
                <input className="fi" type="number" value={stop} onChange={e => setStop(e.target.value)}
                  style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
              </div>
            </div>

            <div>
              {resRow('Dollar Risk', `$${c.dR.toFixed(2)}`, 'var(--ac)')}
              {c.capped && resRow('Actual Risk (capped)', `$${c.actualRisk.toFixed(2)}`, 'var(--amber, #f59e0b)')}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--brd)' }}>
                <span style={{ fontSize: '12px', color: 'var(--txt2)' }}>Shares</span>
                <span style={{ fontSize: '16px', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--orange)' }}>{c.sh.toLocaleString()}</span>
              </div>
              {resRow('Position Value', `$${c.pv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'var(--ac)')}
              {resRow('% of Account', `${c.pa.toFixed(2)}%`, c.pa > (parseFloat(maxPct) || 100) ? 'var(--red)' : 'var(--ac)')}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--brd)' }}>
                <span style={{ fontSize: '12px', color: 'var(--txt2)' }}>Stop Distance</span>
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ac)' }}>${c.sd.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                <span style={{ fontSize: '12px', color: 'var(--txt2)' }}>Stop Distance %</span>
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ac)' }}>{c.sdPct.toFixed(2)}%</span>
              </div>
            </div>
          </div>

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
                    <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid var(--brd)', color: 'var(--txt2)' }}>{c.acc > 0 ? `${t.pctAcc.toFixed(2)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={card}>
            {cardHeader('Trade Inputs', clearFutures)}

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Account Balance</span>
              <div style={{ display: 'flex' }}>
                <span style={{ ...affix, borderRight: 0, borderRadius: 'var(--r) 0 0 var(--r)' }}>$</span>
                <input className="fi" type="number" value={futAccount} onChange={e => setFutAccount(e.target.value)}
                  style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', borderRadius: '0 var(--r) var(--r) 0' }} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Risk Per Trade</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {toggleBtn(futRiskMode === 'pct', () => setFutRiskMode('pct'), '%')}
                  {toggleBtn(futRiskMode === 'fixed', () => setFutRiskMode('fixed'), 'Fixed $')}
                </div>
                <input className="fi" type="number" value={futRiskInput} onChange={e => setFutRiskInput(e.target.value)}
                  style={{ fontFamily: 'var(--mono)' }} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Contract</span>
              <div ref={contractRef} style={{ position: 'relative' }}>
                <div onClick={() => setContractOpen(o => !o)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg4, #16161e)', border: '1px solid var(--brd2, #2a2a35)',
                  borderRadius: 'var(--r)', padding: '8px 11px', fontSize: '12px', color: 'var(--txt)',
                  fontFamily: 'var(--mono)', cursor: 'pointer', userSelect: 'none',
                }}>
                  <span>{futSymbol} — {futContractInfo?.name ?? ''}</span>
                  <span style={{ color: 'var(--txt3)', fontSize: '10px' }}>{contractOpen ? '▴' : '▾'}</span>
                </div>
                {contractOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                    background: '#141419', border: '1px solid var(--brd)', borderRadius: 'var(--r)',
                    maxHeight: '320px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                  }}>
                    {FUT_CATEGORIES.map(cat => (
                      <div key={cat}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '10px 12px 6px' }}>{cat}</div>
                        {FUTURES_CONTRACTS.filter(fut => fut.category === cat).map(fut => (
                          <div key={fut.symbol} onClick={() => { setFutSymbol(fut.symbol); setContractOpen(false) }}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '8px 12px', fontSize: '12px', fontFamily: 'var(--mono)', cursor: 'pointer',
                              background: fut.symbol === futSymbol ? 'var(--bg4, #21212E)' : 'transparent',
                              color: fut.symbol === futSymbol ? 'var(--txt)' : 'var(--txt2)',
                              fontWeight: fut.symbol === futSymbol ? 700 : 400,
                            }}>
                            <span>{fut.symbol} — {fut.name}</span>
                            {fut.symbol === futSymbol && <span style={{ color: 'var(--ac)' }}>✓</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '9px', color: fc.pvUnknown ? 'var(--red)' : 'var(--txt3)', marginTop: '5px' }}>
                {fc.pvUnknown ? 'Point value not found for this contract — contact support.' : `$${fc.pv.toLocaleString()} per point`}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Stop Measured In</span>
              <div style={{ display: 'flex', gap: '6px', maxWidth: '260px' }}>
                {toggleBtn(futStopUnit === 'points', () => setFutStopUnit('points'), 'Points')}
                {toggleBtn(futStopUnit === 'ticks',  () => setFutStopUnit('ticks'),  'Ticks')}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={lbl}>Stop Loss ({futStopUnit === 'ticks' ? 'Ticks' : 'Points'})</span>
              <input className="fi" type="number" value={futStopInput} onChange={e => setFutStopInput(e.target.value)}
                style={{ fontFamily: 'var(--mono)' }} />
            </div>

            <div>
              <span style={lbl}>Take Profit ({futStopUnit === 'ticks' ? 'Ticks' : 'Points'}) · Optional</span>
              <input className="fi" type="number" value={futTakeProfitInput} onChange={e => setFutTakeProfitInput(e.target.value)}
                style={{ fontFamily: 'var(--mono)' }} placeholder="Optional" />
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' }}>
              Position size — {futSymbol} · {futContractInfo?.name ?? ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--orange)' }}>{fc.contracts.toLocaleString()}</span>
              <span style={{ fontSize: '15px', fontWeight: 700 }}>contracts</span>
            </div>
            <div style={{ borderTop: '1px solid var(--brd)', paddingTop: '12px', fontSize: '12px', color: 'var(--txt2)' }}>
              Risking ${fc.riskDollars.toFixed(2)} ({fc.riskPct.toFixed(1)}% of account) with a {fc.stopPts.toFixed(2)}-point stop on {futSymbol}.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {statCard('Target Risk', `$${fc.riskDollars.toFixed(2)}`, `${fc.riskPct.toFixed(1)}% of account`)}
            {statCard('Actual Risk At This Size', `$${fc.actualRisk.toFixed(2)}`, 'Rounded down, never above target')}
            {statCard('Risk Per Contract', `$${fc.riskPerContract.toFixed(2)}`, `${fc.stopPts.toFixed(2)} points stop`)}
            {statCard('Risk : Reward', fc.rr ? `1 : ${fc.rr.toFixed(2)}` : '—', fc.rr ? `${fc.tpPts.toFixed(2)} pt target / ${fc.stopPts.toFixed(2)} pt stop` : 'Add a take profit to see it', fc.rr ? 'var(--ac)' : 'var(--txt3)')}
          </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={card}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Size at Other Risk Levels</div>
              {fc.sizeLevels.map(s => {
                const active = Math.abs(s.lvl - fc.riskPct) < 0.05
                return (
                  <div key={s.lvl} style={{
                    display: 'grid', gridTemplateColumns: '44px 1fr auto', columnGap: '14px', alignItems: 'center',
                    padding: '7px 8px', fontSize: '12px', fontFamily: 'var(--mono)', borderRadius: '6px',
                    background: active ? 'var(--ac-d, rgba(16,185,129,.12))' : 'transparent',
                    color: active ? 'var(--ac)' : 'var(--txt2)', fontWeight: active ? 700 : 400,
                  }}>
                    <span style={{ textAlign: 'left' }}>{s.lvl}%</span>
                    <span style={{ textAlign: 'right', color: active ? 'var(--ac)' : 'var(--txt3)' }}>${Number(s.dollars.toFixed(0)).toLocaleString()}</span>
                    <span style={{ textAlign: 'right' }}>{s.contracts.toLocaleString()} contracts</span>
                  </div>
                )
              })}
              <div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '8px' }}>Same stop, different risk per trade.</div>
            </div>

            <div style={card}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Profit Targets</div>
              <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '12px' }}>
                {fc.targets.map(t => (
                  <div key={t.r} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: '12px', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--brd)' }}>
                    <span style={{ color: 'var(--txt2)' }}>{t.r}R · {t.pointsAway.toFixed(2)} pts away</span>
                    <span style={{ color: 'var(--ac)', fontWeight: 600 }}>+${t.profit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}