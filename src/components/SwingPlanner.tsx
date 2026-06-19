'use client'

import { useState, useEffect } from 'react'

type Plan = {
  id: string
  name: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  accountSize: number
  riskPct: number
  entry: number
  stop: number
  target1: number
  target2: number
  target3: number
  notes: string
  createdAt: string
}

const STORAGE_KEY = 'sleektrade_swing_plans'

function loadPlans(): Plan[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function savePlans(plans: Plan[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
}

function fmt(n: number, dec = 2) {
  return isNaN(n) || !isFinite(n) ? '—' : n.toFixed(dec)
}

function fmtDollar(n: number) {
  if (isNaN(n) || !isFinite(n)) return '—'
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < 0 ? '-$' : '+$') + s
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '24px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  title: { fontSize: '18px', fontWeight: 700, color: 'var(--txt)' },
  subtitle: { fontSize: '12px', color: 'var(--txt3)', marginTop: '2px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' },
  card: { background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '20px' },
  sectionTitle: { fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' },
  label: { fontSize: '11px', color: 'var(--txt3)', marginBottom: '4px' },
  divider: { height: '1px', background: 'var(--brd)', margin: '16px 0' },
  metricRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--brd)' },
  metricLabel: { fontSize: '12px', color: 'var(--txt2)' },
  metricValue: { fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)' },
  targetBlock: { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '12px', marginBottom: '8px' },
  targetLabel: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.05em' },
  planCard: { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '12px', marginBottom: '8px', cursor: 'pointer' },
  planCardActive: { background: 'var(--bg3)', border: '1px solid var(--ac)', borderRadius: 'var(--r)', padding: '12px', marginBottom: '8px', cursor: 'pointer' },
}

export function SwingPlanner() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('New Plan')
  const [symbol, setSymbol] = useState('')
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG')
  const [accountSize, setAccountSize] = useState(25000)
  const [riskPct, setRiskPct] = useState(1)
  const [entry, setEntry] = useState<string>('')
  const [stop, setStop] = useState<string>('')
  const [target1, setTarget1] = useState<string>('')
  const [target2, setTarget2] = useState<string>('')
  const [target3, setTarget3] = useState<string>('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const saved = loadPlans()
    setPlans(saved)
    if (saved.length > 0) loadPlan(saved[0])
  }, [])

  function loadPlan(p: Plan) {
    setActiveId(p.id)
    setName(p.name)
    setSymbol(p.symbol)
    setDirection(p.direction)
    setAccountSize(p.accountSize)
    setRiskPct(p.riskPct)
    setEntry(String(p.entry || ''))
    setStop(String(p.stop || ''))
    setTarget1(String(p.target1 || ''))
    setTarget2(String(p.target2 || ''))
    setTarget3(String(p.target3 || ''))
    setNotes(p.notes || '')
  }

  function newPlan() {
    setActiveId(null)
    setName('New Plan')
    setSymbol('')
    setDirection('LONG')
    setEntry('')
    setStop('')
    setTarget1('')
    setTarget2('')
    setTarget3('')
    setNotes('')
  }

  function savePlan() {
    const p: Plan = {
      id: activeId || crypto.randomUUID(),
      name,
      symbol: symbol.toUpperCase(),
      direction,
      accountSize,
      riskPct,
      entry: parseFloat(entry) || 0,
      stop: parseFloat(stop) || 0,
      target1: parseFloat(target1) || 0,
      target2: parseFloat(target2) || 0,
      target3: parseFloat(target3) || 0,
      notes,
      createdAt: activeId ? (plans.find(x => x.id === activeId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    }
    const updated = activeId
      ? plans.map(x => x.id === activeId ? p : x)
      : [p, ...plans]
    setPlans(updated)
    savePlans(updated)
    setActiveId(p.id)
  }

  function deletePlan(id: string) {
    const updated = plans.filter(x => x.id !== id)
    setPlans(updated)
    savePlans(updated)
    if (activeId === id) {
      if (updated.length > 0) loadPlan(updated[0])
      else newPlan()
    }
  }

  // Calculations
  const e = parseFloat(entry) || 0
  const s = parseFloat(stop) || 0
  const t1 = parseFloat(target1) || 0
  const t2 = parseFloat(target2) || 0
  const t3 = parseFloat(target3) || 0

  const riskDollar = accountSize * (riskPct / 100)
  const stopDist = direction === 'LONG' ? e - s : s - e
  const shares = stopDist > 0 ? Math.floor(riskDollar / stopDist) : 0
  const positionValue = shares * e
  const actualRisk = shares * stopDist

  const calcTarget = (t: number) => {
    if (!t || !e || shares === 0) return null
    const dist = direction === 'LONG' ? t - e : e - t
    const profit = shares * dist
    const rr = stopDist > 0 ? dist / stopDist : 0
    return { dist, profit, rr }
  }

  const r1 = calcTarget(t1)
  const r2 = calcTarget(t2)
  const r3 = calcTarget(t3)

  const green = '#10B981'
  const red = '#EF4444'
  const ac = direction === 'LONG' ? green : red

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Swing Trade Planner</div>
          <div style={S.subtitle}>Plan your entry, risk, and targets before you trade</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={newPlan} className="btn btn-o">+ New Plan</button>
          <button onClick={savePlan} className="btn btn-p">Save Plan</button>
        </div>
      </div>

      <div style={S.grid}>
        {/* LEFT: Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Trade Setup */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Trade Setup</div>
            <div style={{ ...S.row, gridTemplateColumns: '1fr 1fr 120px' }}>
              <div>
                <div style={S.label}>Plan Name</div>
                <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. NVDA breakout" />
              </div>
              <div>
                <div style={S.label}>Symbol</div>
                <input className="fi" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="NVDA" style={{ textTransform: 'uppercase' }} />
              </div>
              <div>
                <div style={S.label}>Direction</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['LONG', 'SHORT'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 'var(--r)', fontSize: '11px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--sans)', border: 'none',
                        background: direction === d ? (d === 'LONG' ? green : red) : 'var(--bg4)',
                        color: direction === d ? '#000' : 'var(--txt3)',
                        transition: '.12s',
                      }}
                    >{d}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={S.divider} />
            <div style={S.sectionTitle}>Risk Parameters</div>
            <div style={S.row}>
              <div>
                <div style={S.label}>Account Size ($)</div>
                <input className="fi" type="number" value={accountSize} onChange={e => setAccountSize(parseFloat(e.target.value) || 0)} placeholder="25000" />
              </div>
              <div>
                <div style={S.label}>Risk per Trade (%)</div>
                <input className="fi" type="number" value={riskPct} onChange={e => setRiskPct(parseFloat(e.target.value) || 0)} placeholder="1" step="0.1" min="0.1" max="10" />
              </div>
            </div>

            <div style={S.divider} />
            <div style={S.sectionTitle}>Price Levels</div>
            <div style={S.row}>
              <div>
                <div style={S.label}>Entry Price ($)</div>
                <input className="fi" type="number" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00" step="0.01" />
              </div>
              <div>
                <div style={S.label}>Stop Loss ($)</div>
                <input className="fi" type="number" value={stop} onChange={e => setStop(e.target.value)} placeholder="0.00" step="0.01"
                  style={{ borderColor: stop ? 'rgba(239,68,68,.4)' : undefined }} />
              </div>
            </div>
            <div style={{ ...S.row, gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div>
                <div style={S.label}>Target 1 ($)</div>
                <input className="fi" type="number" value={target1} onChange={e => setTarget1(e.target.value)} placeholder="0.00" step="0.01"
                  style={{ borderColor: target1 ? 'rgba(16,185,129,.4)' : undefined }} />
              </div>
              <div>
                <div style={S.label}>Target 2 ($)</div>
                <input className="fi" type="number" value={target2} onChange={e => setTarget2(e.target.value)} placeholder="0.00" step="0.01"
                  style={{ borderColor: target2 ? 'rgba(16,185,129,.3)' : undefined }} />
              </div>
              <div>
                <div style={S.label}>Target 3 ($)</div>
                <input className="fi" type="number" value={target3} onChange={e => setTarget3(e.target.value)} placeholder="0.00" step="0.01"
                  style={{ borderColor: target3 ? 'rgba(16,185,129,.2)' : undefined }} />
              </div>
            </div>
          </div>

          {/* Visual price ladder */}
          {e > 0 && s > 0 && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Price Ladder</div>
              <div style={{ position: 'relative', padding: '0 16px' }}>
                {[
                  ...(t3 ? [{ label: 'Target 3', price: t3, color: green, opacity: 0.6 }] : []),
                  ...(t2 ? [{ label: 'Target 2', price: t2, color: green, opacity: 0.8 }] : []),
                  ...(t1 ? [{ label: 'Target 1', price: t1, color: green, opacity: 1 }] : []),
                  { label: 'Entry', price: e, color: ac, opacity: 1 },
                  { label: 'Stop Loss', price: s, color: red, opacity: 1 },
                ]
                  .sort((a, b) => direction === 'LONG' ? b.price - a.price : a.price - b.price)
                  .map((level, i, arr) => (
                    <div key={level.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: i < arr.length - 1 ? '0' : '0' }}>
                      <div style={{ width: '80px', fontSize: '10px', fontWeight: 700, color: level.color, opacity: level.opacity, textAlign: 'right', flexShrink: 0 }}>
                        {level.label}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: level.color, opacity: level.opacity, flexShrink: 0 }} />
                        {i < arr.length - 1 && (
                          <div style={{ position: 'absolute', left: '106px', marginTop: '10px', width: '2px', height: '32px', background: 'var(--brd2)' }} />
                        )}
                        <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)', color: level.color, opacity: level.opacity }}>
                          ${fmt(level.price)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Trade Notes & Thesis</div>
            <textarea
              className="fi"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why are you taking this trade? What's the setup? Key levels to watch..."
              style={{ minHeight: '100px' }}
            />
          </div>
        </div>

        {/* RIGHT: Results + Saved Plans */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Position Summary */}
          <div style={{ ...S.card, borderColor: e && s ? 'var(--brd2)' : 'var(--brd)' }}>
            <div style={S.sectionTitle}>Position Summary</div>

            <div style={S.metricRow}>
              <span style={S.metricLabel}>Risk Amount</span>
              <span style={{ ...S.metricValue, color: red }}>${riskDollar.toFixed(2)}</span>
            </div>
            <div style={S.metricRow}>
              <span style={S.metricLabel}>Stop Distance</span>
              <span style={{ ...S.metricValue, color: 'var(--txt)' }}>${fmt(stopDist)}</span>
            </div>
            <div style={{ ...S.metricRow, background: 'var(--ac-d)', margin: '8px -20px', padding: '10px 20px', borderBottom: '1px solid var(--brd)' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: green }}>Share Size</span>
              <span style={{ fontSize: '22px', fontWeight: 800, color: green, fontFamily: 'var(--mono)' }}>
                {shares > 0 ? shares.toLocaleString() : '—'}
              </span>
            </div>
            <div style={S.metricRow}>
              <span style={S.metricLabel}>Position Value</span>
              <span style={{ ...S.metricValue, color: 'var(--txt)' }}>${positionValue > 0 ? positionValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}</span>
            </div>
            <div style={S.metricRow}>
              <span style={S.metricLabel}>Actual Risk $</span>
              <span style={{ ...S.metricValue, color: red }}>{actualRisk > 0 ? fmtDollar(-actualRisk) : '—'}</span>
            </div>
          </div>

          {/* Targets */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Risk / Reward Targets</div>
            {[
              { label: 'Target 1', r: r1, t: t1 },
              { label: 'Target 2', r: r2, t: t2 },
              { label: 'Target 3', r: r3, t: t3 },
            ].map(({ label, r, t }) => (
              <div key={label} style={S.targetBlock}>
                <div style={S.targetLabel}>{label} {t ? `— $${fmt(t)}` : '(not set)'}</div>
                {r ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '2px' }}>Move</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: green, fontFamily: 'var(--mono)' }}>+${fmt(r.dist)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '2px' }}>Profit</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: green, fontFamily: 'var(--mono)' }}>{fmtDollar(r.profit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', marginBottom: '2px' }}>R:R</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: r.rr >= 2 ? green : r.rr >= 1 ? 'var(--orange)' : red, fontFamily: 'var(--mono)' }}>
                        {fmt(r.rr, 1)}R
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>Enter target price above</div>
                )}
              </div>
            ))}
          </div>

          {/* Saved Plans */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={S.sectionTitle}>Saved Plans ({plans.length})</div>
            </div>
            {plans.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--txt3)', textAlign: 'center', padding: '16px 0' }}>
                No saved plans yet. Fill in the form and click Save Plan.
              </div>
            )}
            {plans.map(p => (
              <div
                key={p.id}
                onClick={() => loadPlan(p)}
                style={activeId === p.id ? S.planCardActive : S.planCard}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)' }}>{p.symbol || '—'}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: p.direction === 'LONG' ? green : red, background: p.direction === 'LONG' ? 'var(--ac-d)' : 'var(--red-d)', padding: '1px 6px', borderRadius: '4px' }}>{p.direction}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>
                      Entry ${p.entry.toFixed(2)} · Stop ${p.stop.toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={ev => { ev.stopPropagation(); deletePlan(p.id) }}
                    style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '14px', padding: '4px', fontFamily: 'var(--sans)' }}
                    title="Delete plan"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
