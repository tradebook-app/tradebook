'use client'

import { useState, useEffect } from 'react'
import type { StrategyRow, TradeRow, StrategyRuleGroupWithRules, StrategyRuleGroupDraft } from '@/lib/types'
import { fetchRuleGroups, saveRuleGroups } from '@/lib/strategyService'
import { calcStrategyStats, tradesForStrategy, calcCumulative, fmtPnl, fmtDate } from '@/lib/analytics'
import { MetricCard } from '@/components/ui/MetricCard'
import { CumulativeChart } from '@/components/dashboard/CumulativeChart'

type Props = {
  strategy: StrategyRow
  trades: TradeRow[]
  imgUrl: string | null
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

type Tab = 'stats' | 'rules' | 'trades'

export function StrategyDetail({ strategy, trades, imgUrl, onBack, onEdit, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('stats')
  const [groups,  setGroups]  = useState<StrategyRuleGroupWithRules[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRules, setEditingRules] = useState(false)
  const [draft, setDraft] = useState<StrategyRuleGroupDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchRuleGroups(strategy.id).then(data => { setGroups(data); setLoading(false) })
  }, [strategy.id])

  const matched = tradesForStrategy(trades, strategy)
  const stats   = calcStrategyStats(trades, strategy)
  const curve   = calcCumulative(matched)
  const closedSorted = [...matched]
    .filter(t => t.exit && t.exit > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  function startEditingRules() {
    setDraft(groups.map(g => ({ id: g.id, name: g.name, rules: g.rules.map(r => ({ id: r.id, text: r.text })) })))
    setEditingRules(true)
  }

  function addGroup() {
    setDraft(prev => [...prev, { name: '', rules: [{ text: '' }] }])
  }

  function addRule(gi: number) {
    setDraft(prev => prev.map((g, i) => i === gi ? { ...g, rules: [...g.rules, { text: '' }] } : g))
  }

  async function handleSaveRules() {
    setSaving(true)
    const ok = await saveRuleGroups(strategy.id, draft)
    if (ok) {
      const fresh = await fetchRuleGroups(strategy.id)
      setGroups(fresh)
      setEditingRules(false)
    } else {
      alert('Could not save rules — try again.')
    }
    setSaving(false)
  }

  const groupLabel = { fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: '4px', display: 'block' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
        <button
          onClick={onBack}
          className="btn btn-o"
          style={{ flexShrink: 0, marginTop: '2px' }}
        >← Back</button>

        {imgUrl && (
          <img src={imgUrl} style={{ width: '52px', height: '52px', borderRadius: 'var(--r)', objectFit: 'cover', border: '1px solid var(--brd)', flexShrink: 0 }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '17px', fontWeight: 800 }}>{strategy.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' }}>
            {stats.trades} {stats.trades === 1 ? 'trade' : 'trades'} logged · {fmtPnl(stats.netPnl)} net
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button className="btn btn-o" onClick={onEdit}>✎ Edit</button>
          <button className="btn btn-d" onClick={onDelete}>✕ Delete</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--brd)', marginBottom: '18px' }}>
        <button className={`stab ${tab === 'stats'  ? 'active' : ''}`} onClick={() => setTab('stats')}>Stats</button>
        <button className={`stab ${tab === 'rules'  ? 'active' : ''}`} onClick={() => setTab('rules')}>Rules {groups.length > 0 && `(${groups.reduce((s, g) => s + g.rules.length, 0)})`}</button>
        <button className={`stab ${tab === 'trades' ? 'active' : ''}`} onClick={() => setTab('trades')}>Trades ({matched.length})</button>
      </div>

      {/* ─── STATS TAB ─────────────────────────────────────────────────── */}
      {tab === 'stats' && (
        stats.trades === 0 ? (
          <div className="empty" style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)' }}>
            No trades tagged to this strategy yet.<br />
            Set <b style={{ color: 'var(--txt2)' }}>Setup</b> to <b style={{ color: 'var(--txt2)' }}>&ldquo;{strategy.name}&rdquo;</b> when logging a trade to see stats here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <MetricCard
                label="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                gauge={{ pct: stats.winRate, color: stats.winRate >= 50 ? 'var(--ac)' : 'var(--red)' }}
              />
              <MetricCard
                label="Profit Factor"
                value={stats.profitFactor.toFixed(2)}
                gauge={{ pct: Math.min(stats.profitFactor / 3 * 100, 100), color: stats.profitFactor >= 1.5 ? 'var(--ac)' : 'var(--red)' }}
              />
              <MetricCard label="Net P&L" value={fmtPnl(stats.netPnl)} valueColor={stats.netPnl >= 0 ? 'var(--ac)' : 'var(--red)'} />
              <MetricCard label="Trades" value={stats.trades} sub={<span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{stats.wins}W · {stats.losses}L</span>} />
              <MetricCard label="Avg Win" value={`+$${stats.avgWin.toFixed(2)}`} valueColor="var(--ac)" />
              <MetricCard label="Avg Loss" value={`-$${stats.avgLoss.toFixed(2)}`} valueColor="var(--red)" />
            </div>

            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontWeight: 700, color: 'var(--txt2)' }}>Equity Curve — This Strategy</div>
              <div style={{ padding: '16px 18px' }}>
                <CumulativeChart labels={curve.labels} data={curve.data} />
              </div>
            </div>
          </div>
        )
      )}

      {/* ─── RULES TAB ─────────────────────────────────────────────────── */}
      {tab === 'rules' && (
        loading ? (
          <div className="empty">Loading...</div>
        ) : !editingRules ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <button className="btn btn-o" onClick={startEditingRules}>✎ Edit Rules</button>
            </div>
            {groups.length === 0 ? (
              <div className="empty" style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)' }}>
                No rules yet. Add entry criteria, exit criteria, or market conditions to build your playbook.
                <div style={{ marginTop: '12px' }}>
                  <button className="btn btn-p" onClick={startEditingRules}>+ Add Rules</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groups.map(g => (
                  <div key={g.id} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                    <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--brd)', fontSize: '12px', fontWeight: 700 }}>{g.name}</div>
                    {g.rules.map(r => (
                      <div key={r.id} className="sr">
                        <span className="sr-n" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--ac)', flexShrink: 0 }} />
                          {r.text}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
              {draft.map((g, gi) => (
                <div key={gi} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input
                      className="fi"
                      placeholder="Group name — e.g. Entry Criteria"
                      value={g.name}
                      onChange={e => setDraft(prev => prev.map((x, i) => i === gi ? { ...x, name: e.target.value } : x))}
                      style={{ fontWeight: 700 }}
                    />
                    <button
                      className="btn-d"
                      style={{ padding: '4px 10px', borderRadius: 'var(--r)', cursor: 'pointer' }}
                      onClick={() => setDraft(prev => prev.filter((_, i) => i !== gi))}
                    >✕</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {g.rules.map((r, ri) => (
                      <div key={ri} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          className="fi"
                          placeholder="Rule — e.g. Price within 2% of 50-day MA"
                          value={r.text}
                          onChange={e => setDraft(prev => prev.map((x, i) => i === gi
                            ? { ...x, rules: x.rules.map((rr, j) => j === ri ? { ...rr, text: e.target.value } : rr) }
                            : x))}
                        />
                        <button
                          className="btn-d"
                          style={{ padding: '4px 10px', borderRadius: 'var(--r)', cursor: 'pointer' }}
                          onClick={() => setDraft(prev => prev.map((x, i) => i === gi
                            ? { ...x, rules: x.rules.filter((_, j) => j !== ri) }
                            : x))}
                        >✕</button>
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn btn-o"
                    style={{ marginTop: '10px', fontSize: '10px', padding: '4px 10px' }}
                    onClick={() => addRule(gi)}
                  >+ Add Rule</button>
                </div>
              ))}
            </div>

            <button className="btn btn-o" onClick={addGroup} style={{ marginBottom: '16px' }}>+ Add Rule Group</button>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--brd)', paddingTop: '14px' }}>
              <button className="btn btn-o" onClick={() => setEditingRules(false)}>Cancel</button>
              <button className="btn btn-p" onClick={handleSaveRules} disabled={saving}>{saving ? 'Saving...' : 'Save Rules'}</button>
            </div>
          </div>
        )
      )}

      {/* ─── TRADES TAB ─────────────────────────────────────────────────── */}
      {tab === 'trades' && (
        closedSorted.length === 0 ? (
          <div className="empty" style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)' }}>
            No closed trades tagged to this strategy yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th><th>Symbol</th><th>Status</th><th>Side</th>
                  <th className="r">Entry</th><th className="r">Exit</th><th className="r">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {closedSorted.map(t => {
                  const isW = t.pnl > 0, isL = t.pnl < 0
                  return (
                    <tr key={t.id}>
                      <td style={{ fontSize: '10px', color: 'var(--txt2)' }}>{fmtDate(t.date)}</td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{t.symbol}</td>
                      <td><span className={isW ? 'badge badge-win' : isL ? 'badge badge-loss' : 'badge badge-be'}>{isW ? 'WIN' : isL ? 'LOSS' : 'BE'}</span></td>
                      <td><span className={t.type === 'Long' ? 'badge badge-long' : 'badge badge-short'}>{t.type}</span></td>
                      <td className="r" style={{ fontFamily: 'var(--mono)' }}>{t.entry ? `$${t.entry}` : ''}</td>
                      <td className="r" style={{ fontFamily: 'var(--mono)' }}>{t.exit ? `$${t.exit}` : '—'}</td>
                      <td className="r" style={{ fontFamily: 'var(--mono)', color: isW ? 'var(--ac)' : isL ? 'var(--red)' : '', fontWeight: 600 }}>{fmtPnl(t.pnl)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
