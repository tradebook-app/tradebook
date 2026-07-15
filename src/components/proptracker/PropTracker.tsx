'use client'

import { useState, useEffect, useMemo } from 'react'
import type {
  PropFirmAccountRow, PropFirmAccountInsert,
  PropFirmTransactionRow, PropFirmTransactionInsert,
} from '@/lib/types'
import {
  fetchPropFirmAccounts, insertPropFirmAccount, updatePropFirmAccount, deletePropFirmAccount,
  fetchPropFirmTransactions, insertPropFirmTransaction, updatePropFirmTransaction, deletePropFirmTransaction,
} from '@/lib/propTrackerService'
import { Modal } from '@/components/ui/Modal'
import { CardMenu } from '@/components/ui/CardMenu'
import { MetricCard } from '@/components/ui/MetricCard'
import { CumulativeChart } from '@/components/dashboard/CumulativeChart'
import { PropFirmDonutChart } from '@/components/proptracker/PropFirmDonutChart'

type Props = { userId: string }

const FIRM_PRESETS = [
  'TopStep', 'Apex Trader Funding', 'My Funded Futures (MFFU)', 'FTMO', 'The5ers',
  'E8 Markets', 'FundedNext', 'Funded Trading Plus', 'Tradeday', 'Tradeify',
  'Take Profit Trader', 'Funding Pips', 'Lucid Trading', 'Alpha Futures', 'Aqua Funded',
]

const ACCOUNT_SIZES = [10000, 25000, 50000, 75000, 80000, 100000, 150000, 200000, 300000]

const CURRENCIES = ['USD', 'EUR', 'GBP']

const ACCOUNT_TYPES: { value: PropFirmAccountRow['account_type']; label: string }[] = [
  { value: 'evaluation', label: 'Evaluation' },
  { value: 'funded',     label: 'Funded' },
  { value: 'instant',    label: 'Instant Funding' },
]

const STATUSES: { value: PropFirmAccountRow['status']; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'var(--ac)' },
  { value: 'passed', label: 'Passed', color: 'var(--blue, #3B82F6)' },
  { value: 'failed', label: 'Failed', color: 'var(--red)' },
  { value: 'reset',  label: 'Reset',  color: 'var(--orange, #F59E0B)' },
]

const CATEGORIES: { value: PropFirmTransactionRow['category']; label: string }[] = [
  { value: 'fee',    label: 'Evaluation Fee' },
  { value: 'reset',  label: 'Reset' },
  { value: 'payout', label: 'Payout' },
  { value: 'other',  label: 'Other' },
]

const BREACH_REASONS = [
  'Overtraded', 'Hit max daily loss', 'Hit max drawdown', 'Held overnight',
  'Full ported', 'News event violation', "Didn't take profit", 'Followed an alert', 'Other',
]

const DONUT_COLORS = ['#F5C542', '#3B82F6', '#10B981', '#EF4444', '#A855F7', '#F97316', '#EC4899', '#14B8A6']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function fmtMoney(n: number) {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(s: string) {
  return new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function fmtDateFull(s: string) {
  return new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Derives 2-letter initials from a firm name — handles "TopStep" (camel case),
// "Apex Trader Funding" (multi-word), and "FTMO" (all caps) the same way.
function initials(name: string) {
  const parts = name.match(/[A-Z][a-z]*|[a-z]+/g) || [name]
  const a = parts[0]?.[0] || name[0] || '?'
  const b = parts[1]?.[0] || parts[0]?.[1] || ''
  return (a + b).toUpperCase()
}

function statusMeta(status: string) {
  return STATUSES.find(s => s.value === status) || STATUSES[0]
}

function numOrNull(s: string) {
  if (s.trim() === '') return null
  const n = Number(s)
  return isNaN(n) ? null : n
}

function ProgressRow({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
        <span style={{ color: 'var(--txt3)' }}>{label}</span>
        <span style={{ color: 'var(--txt2)' }}>${current.toLocaleString('en-US', { maximumFractionDigits: 0 })} of ${target.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
      </div>
      <div style={{ height: '5px', background: 'var(--bg4)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  )
}

export function PropTracker({ userId }: Props) {
  const [accounts, setAccounts] = useState<PropFirmAccountRow[]>([])
  const [txns, setTxns] = useState<PropFirmTransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Account modal
  const [acctModal, setAcctModal] = useState(false)
  const [editingAcct, setEditingAcct] = useState<PropFirmAccountRow | null>(null)
  const [firmChoice, setFirmChoice] = useState(FIRM_PRESETS[0])
  const [customFirm, setCustomFirm] = useState('')
  const [sizeChoice, setSizeChoice] = useState<number>(100000)
  const [customSize, setCustomSize] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [acctType, setAcctType] = useState<PropFirmAccountRow['account_type']>('evaluation')
  const [acctStatus, setAcctStatus] = useState<PropFirmAccountRow['status']>('active')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [savingAcct, setSavingAcct] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [profitTarget, setProfitTarget] = useState('')
  const [maxDailyLoss, setMaxDailyLoss] = useState('')
  const [maxDrawdown, setMaxDrawdown] = useState('')
  const [minTradingDays, setMinTradingDays] = useState('')
  const [currentProfit, setCurrentProfit] = useState('')
  const [currentDailyLoss, setCurrentDailyLoss] = useState('')
  const [currentTradingDays, setCurrentTradingDays] = useState('')
  const [failureReason, setFailureReason] = useState('')

  // Transaction modal
  const [txnModal, setTxnModal] = useState(false)
  const [txnAccountId, setTxnAccountId] = useState<string | null>(null)
  const [editingTxn, setEditingTxn] = useState<PropFirmTransactionRow | null>(null)
  const [txnAmount, setTxnAmount] = useState('')
  const [txnDate, setTxnDate] = useState(todayISO())
  const [txnCategory, setTxnCategory] = useState<PropFirmTransactionRow['category']>('fee')
  const [txnDescription, setTxnDescription] = useState('')
  const [savingTxn, setSavingTxn] = useState(false)

  useEffect(() => {
    Promise.all([fetchPropFirmAccounts(), fetchPropFirmTransactions()]).then(([a, t]) => {
      setAccounts(a); setTxns(t); setLoading(false)
    })
  }, [])

  // ─── Derived stats ──────────────────────────────────────────────────────

  const txnsByAccount = useMemo(() => {
    const map: Record<string, PropFirmTransactionRow[]> = {}
    for (const t of txns) (map[t.account_id] ||= []).push(t)
    return map
  }, [txns])

  const accountStats = useMemo(() => {
    const map: Record<string, { invested: number; earned: number; pnl: number }> = {}
    for (const acc of accounts) {
      const list = txnsByAccount[acc.id] || []
      const invested = list.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
      const earned   = list.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      map[acc.id] = { invested, earned, pnl: earned - invested }
    }
    return map
  }, [accounts, txnsByAccount])

  const totals = useMemo(() => {
    const invested = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const earned   = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const pnl = earned - invested
    const roi = invested > 0 ? (pnl / invested) * 100 : 0
    const activeAccounts = accounts.filter(a => a.status === 'active').length
    return { invested, earned, pnl, roi, activeAccounts, totalAccounts: accounts.length }
  }, [txns, accounts])

  const spendByFirm = useMemo(() => {
    const map: Record<string, number> = {}
    for (const acc of accounts) {
      const spent = accountStats[acc.id]?.invested || 0
      if (spent > 0) map[acc.firm_name] = (map[acc.firm_name] || 0) + spent
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [accounts, accountStats])

  const cumulativeChart = useMemo(() => {
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date))
    let running = 0
    const labels: string[] = []
    const data: number[] = []
    for (const t of sorted) {
      running += t.amount
      labels.push(fmtDateFull(t.date))
      data.push(running)
    }
    return { labels, data }
  }, [txns])

  const breachCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const acc of accounts) {
      if (acc.status === 'failed' && acc.failure_reason) {
        map[acc.failure_reason] = (map[acc.failure_reason] || 0) + 1
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [accounts])

  // ─── Account modal handlers ─────────────────────────────────────────────

  function openNewAccount() {
    setEditingAcct(null)
    setFirmChoice(FIRM_PRESETS[0]); setCustomFirm('')
    setSizeChoice(100000); setCustomSize('')
    setCurrency('USD'); setAcctType('evaluation'); setAcctStatus('active')
    setStartDate(todayISO()); setEndDate(''); setNotes('')
    setRulesOpen(false)
    setProfitTarget(''); setMaxDailyLoss(''); setMaxDrawdown(''); setMinTradingDays('')
    setCurrentProfit(''); setCurrentDailyLoss(''); setCurrentTradingDays('')
    setFailureReason('')
    setAcctModal(true)
  }

  function openEditAccount(acc: PropFirmAccountRow) {
    setEditingAcct(acc)
    const isPreset = FIRM_PRESETS.includes(acc.firm_name)
    setFirmChoice(isPreset ? acc.firm_name : 'Custom...')
    setCustomFirm(isPreset ? '' : acc.firm_name)
    const isPresetSize = ACCOUNT_SIZES.includes(acc.account_size)
    setSizeChoice(isPresetSize ? acc.account_size : -1)
    setCustomSize(isPresetSize ? '' : String(acc.account_size))
    setCurrency(acc.currency)
    setAcctType(acc.account_type)
    setAcctStatus(acc.status)
    setStartDate(acc.start_date)
    setEndDate(acc.end_date || '')
    setNotes(acc.notes || '')
    setRulesOpen(!!(acc.profit_target || acc.max_daily_loss || acc.max_drawdown || acc.min_trading_days))
    setProfitTarget(acc.profit_target != null ? String(acc.profit_target) : '')
    setMaxDailyLoss(acc.max_daily_loss != null ? String(acc.max_daily_loss) : '')
    setMaxDrawdown(acc.max_drawdown != null ? String(acc.max_drawdown) : '')
    setMinTradingDays(acc.min_trading_days != null ? String(acc.min_trading_days) : '')
    setCurrentProfit(acc.current_profit != null ? String(acc.current_profit) : '')
    setCurrentDailyLoss(acc.current_daily_loss != null ? String(acc.current_daily_loss) : '')
    setCurrentTradingDays(acc.current_trading_days != null ? String(acc.current_trading_days) : '')
    setFailureReason(acc.failure_reason || '')
    setAcctModal(true)
  }

  async function handleSaveAccount() {
    const firmName = firmChoice === 'Custom...' ? customFirm.trim() : firmChoice
    if (!firmName) return alert('Enter a firm name')
    const size = sizeChoice === -1 ? Number(customSize) : sizeChoice
    if (!size || size <= 0) return alert('Enter a valid account size')

    const payload: PropFirmAccountInsert = {
      firm_name: firmName,
      account_size: size,
      currency,
      account_type: acctType,
      status: acctStatus,
      start_date: startDate,
      end_date: endDate || null,
      notes: notes.trim() || null,
      profit_target: numOrNull(profitTarget),
      max_daily_loss: numOrNull(maxDailyLoss),
      max_drawdown: numOrNull(maxDrawdown),
      min_trading_days: numOrNull(minTradingDays),
      current_profit: numOrNull(currentProfit),
      current_daily_loss: numOrNull(currentDailyLoss),
      current_trading_days: numOrNull(currentTradingDays),
      failure_reason: acctStatus === 'failed' ? (failureReason || null) : null,
    }

    setSavingAcct(true)
    if (editingAcct) {
      const updated = await updatePropFirmAccount(editingAcct.id, payload)
      if (updated) setAccounts(prev => prev.map(a => a.id === editingAcct.id ? updated : a))
    } else {
      const inserted = await insertPropFirmAccount(payload, userId)
      if (inserted) setAccounts(prev => [inserted, ...prev])
    }
    setSavingAcct(false); setAcctModal(false)
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm('Delete this account and all its transactions? This can\'t be undone.')) return
    const ok = await deletePropFirmAccount(id)
    if (ok) {
      setAccounts(prev => prev.filter(a => a.id !== id))
      setTxns(prev => prev.filter(t => t.account_id !== id))
    }
  }

  // ─── Transaction modal handlers ─────────────────────────────────────────

  function openNewTxn(accountId: string) {
    setTxnAccountId(accountId); setEditingTxn(null)
    setTxnAmount(''); setTxnDate(todayISO()); setTxnCategory('fee'); setTxnDescription('')
    setTxnModal(true)
  }

  function openEditTxn(t: PropFirmTransactionRow) {
    setTxnAccountId(t.account_id); setEditingTxn(t)
    setTxnAmount(String(t.amount)); setTxnDate(t.date)
    setTxnCategory(t.category); setTxnDescription(t.description || '')
    setTxnModal(true)
  }

  async function handleSaveTxn() {
    const amt = Number(txnAmount)
    if (!txnAmount || isNaN(amt) || amt === 0) return alert('Enter an amount — negative for fees/resets, positive for payouts')
    if (!txnAccountId) return

    const payload: PropFirmTransactionInsert = {
      account_id: txnAccountId,
      amount: amt,
      date: txnDate,
      category: txnCategory,
      status: editingTxn?.status || 'not_reviewed',
      description: txnDescription.trim() || null,
    }

    setSavingTxn(true)
    if (editingTxn) {
      const updated = await updatePropFirmTransaction(editingTxn.id, payload)
      if (updated) setTxns(prev => prev.map(t => t.id === editingTxn.id ? updated : t))
    } else {
      const inserted = await insertPropFirmTransaction(payload, userId)
      if (inserted) setTxns(prev => [inserted, ...prev])
    }
    setSavingTxn(false); setTxnModal(false)
  }

  async function handleDeleteTxn(id: string) {
    if (!confirm('Delete this transaction?')) return
    const ok = await deletePropFirmTransaction(id)
    if (ok) setTxns(prev => prev.filter(t => t.id !== id))
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '40px' }}>Loading...</div>
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>
          Track fees, resets, and payouts across your prop firms
        </div>
        {accounts.length > 0 && <button className="btn btn-p" onClick={openNewAccount}>+ Add Account</button>}
      </div>

      {accounts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', minHeight: '300px' }}>
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>🏦</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>No prop firm accounts yet</div>
          <div style={{ fontSize: '13px', color: 'var(--txt2)', marginBottom: '24px', maxWidth: '380px' }}>
            Add every evaluation, funded seat, or instant funding account. Log fees and payouts against it and this tracks your true net P&amp;L and ROI across firms.
          </div>
          <button className="btn btn-p" onClick={openNewAccount}>+ Add Your Account</button>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
            <MetricCard label="Total Invested" value={fmtMoney(totals.invested)} sub={<div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '3px' }}>All fees paid</div>} />
            <MetricCard label="Total Earned" value={fmtMoney(totals.earned)} sub={<div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '3px' }}>All payouts received</div>} />
            <MetricCard label="Net P&L" value={`${totals.pnl >= 0 ? '+' : ''}${fmtMoney(totals.pnl)}`} valueColor={totals.pnl >= 0 ? 'var(--ac)' : 'var(--red)'} sub={<div style={{ fontSize: '9px', color: totals.pnl >= 0 ? 'var(--ac)' : 'var(--red)', marginTop: '3px' }}>{totals.roi >= 0 ? '+' : ''}{totals.roi.toFixed(1)}% ROI</div>} />
            <MetricCard label="Active Accounts" value={String(totals.activeAccounts)} sub={<div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '3px' }}>of {totals.totalAccounts} total</div>} />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px' }}>Spend by Firm</div>
              {spendByFirm.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', padding: '30px 0' }}>No fees logged yet</div>
              ) : (
                <PropFirmDonutChart
                  labels={spendByFirm.map(([firm]) => firm)}
                  data={spendByFirm.map(([, amt]) => amt)}
                  colors={DONUT_COLORS}
                />
              )}
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>P&amp;L Over Time</div>
                <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--mono)', color: totals.pnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>
                  {totals.pnl >= 0 ? '+' : ''}{fmtMoney(totals.pnl)}
                </div>
              </div>
              <div style={{ height: '200px', position: 'relative' }}>
                <CumulativeChart labels={cumulativeChart.labels} data={cumulativeChart.data} />
              </div>
            </div>
          </div>

          {breachCounts.length > 0 && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px' }}>Top Breach Reasons</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {breachCounts.map(([reason, count]) => (
                  <div key={reason}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                      <span>{reason}</span>
                      <span style={{ color: 'var(--txt3)' }}>{count}</span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--bg4)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(count / breachCounts[0][1]) * 100}%`, height: '100%', background: 'var(--red)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
            {accounts.map(acc => {
              const stats = accountStats[acc.id] || { invested: 0, earned: 0, pnl: 0 }
              const meta = statusMeta(acc.status)
              const accTxns = (txnsByAccount[acc.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date))
              const isOpen = expanded.has(acc.id)
              return (
                <div key={acc.id} style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: 'var(--r2)', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--bg5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--txt2)', flexShrink: 0 }}>
                        {initials(acc.firm_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{acc.firm_name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>
                          ${(acc.account_size / 1000).toFixed(0)}k · {ACCOUNT_TYPES.find(t => t.value === acc.account_type)?.label} · Since {fmtDate(acc.start_date)}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: `${meta.color}22`, color: meta.color, flexShrink: 0 }}>
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Invested</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmtMoney(stats.invested)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Earned</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)' }}>{stats.earned > 0 ? fmtMoney(stats.earned) : '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>P&amp;L</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)', color: stats.pnl >= 0 ? 'var(--ac)' : 'var(--red)' }}>
                        {stats.pnl >= 0 ? '+' : '-'}${Math.abs(stats.pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  {(acc.profit_target || acc.min_trading_days || acc.max_daily_loss) && (
                    <div style={{ marginBottom: '10px', padding: '10px', background: 'var(--bg4)', borderRadius: 'var(--r)' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '8px' }}>Path to Funding</div>
                      {acc.profit_target && (
                        <ProgressRow label="Profit" current={acc.current_profit || 0} target={acc.profit_target} color="var(--ac)" />
                      )}
                      {acc.min_trading_days && (
                        <ProgressRow label="Trading days" current={acc.current_trading_days || 0} target={acc.min_trading_days} color="var(--blue, #3B82F6)" />
                      )}
                      {acc.max_daily_loss && (
                        <ProgressRow label="Daily loss used" current={acc.current_daily_loss || 0} target={acc.max_daily_loss} color="var(--orange, #F59E0B)" />
                      )}
                    </div>
                  )}

                  {acc.notes && (
                    <div style={{ fontSize: '11px', color: 'var(--txt2)', lineHeight: 1.5, marginBottom: '10px' }}>{acc.notes}</div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--brd)' }}>
                    <button className="btn btn-o" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={() => openNewTxn(acc.id)}>+ Add Transaction</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => toggleExpanded(acc.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--txt3)', fontSize: '11px', cursor: accTxns.length ? 'pointer' : 'default', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        {accTxns.length} transaction{accTxns.length === 1 ? '' : 's'}
                        {accTxns.length > 0 && <span style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '.15s', display: 'inline-block' }}>⌄</span>}
                      </button>
                      <CardMenu onEdit={() => openEditAccount(acc)} onDelete={() => handleDeleteAccount(acc.id)} />
                    </div>
                  </div>

                  {isOpen && accTxns.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {accTxns.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg4)', borderRadius: 'var(--r)', fontSize: '11px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ color: 'var(--txt)' }}>{CATEGORIES.find(c => c.value === t.category)?.label}{t.description ? ` — ${t.description}` : ''}</span>
                            <span style={{ fontSize: '9px', color: 'var(--txt3)' }}>{fmtDateFull(t.date)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: t.amount >= 0 ? 'var(--ac)' : 'var(--red)' }}>
                              {t.amount >= 0 ? '+' : '-'}${Math.abs(t.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </span>
                            <CardMenu onEdit={() => openEditTxn(t)} onDelete={() => handleDeleteTxn(t.id)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Add / Edit Account Modal */}
      <Modal
        open={acctModal}
        onClose={() => setAcctModal(false)}
        title={editingAcct ? 'Edit Account' : 'New Account'}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setAcctModal(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSaveAccount} disabled={savingAcct}>{savingAcct ? 'Saving...' : editingAcct ? 'Save Changes' : 'Add Account'}</button>
          </>
        }
      >
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Prop Firm</label>
          <select className="fi" value={firmChoice} onChange={e => setFirmChoice(e.target.value)}>
            {FIRM_PRESETS.map(f => <option key={f} value={f}>{f}</option>)}
            <option value="Custom...">Custom...</option>
          </select>
          {firmChoice === 'Custom...' && (
            <input className="fi" style={{ marginTop: '6px' }} value={customFirm} onChange={e => setCustomFirm(e.target.value)} placeholder="Enter firm name" autoFocus />
          )}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Account Size</label>
            <select className="fi" style={{ width: 'auto', fontSize: '10px', padding: '3px 8px' }} value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ACCOUNT_SIZES.map(sz => (
              <button key={sz} onClick={() => setSizeChoice(sz)} style={{
                padding: '5px 12px', borderRadius: 'var(--r)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                background: sizeChoice === sz ? 'var(--ac)' : 'var(--bg4)',
                color: sizeChoice === sz ? '#000' : 'var(--txt2)',
                border: '1px solid ' + (sizeChoice === sz ? 'var(--ac)' : 'var(--brd2)'), fontFamily: 'var(--sans)',
              }}>${sz / 1000}k</button>
            ))}
            <button onClick={() => setSizeChoice(-1)} style={{
              padding: '5px 12px', borderRadius: 'var(--r)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              background: sizeChoice === -1 ? 'var(--ac)' : 'var(--bg4)',
              color: sizeChoice === -1 ? '#000' : 'var(--txt2)',
              border: '1px solid ' + (sizeChoice === -1 ? 'var(--ac)' : 'var(--brd2)'), fontFamily: 'var(--sans)',
            }}>Custom</button>
          </div>
          {sizeChoice === -1 && (
            <input className="fi" type="number" style={{ marginTop: '6px' }} value={customSize} onChange={e => setCustomSize(e.target.value)} placeholder="e.g. 400000" />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Account Type</label>
            <select className="fi" value={acctType} onChange={e => setAcctType(e.target.value as PropFirmAccountRow['account_type'])}>
              {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Status</label>
            <select className="fi" value={acctStatus} onChange={e => setAcctStatus(e.target.value as PropFirmAccountRow['status'])}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {acctStatus === 'failed' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Reason for Failure</label>
            <select className="fi" value={failureReason} onChange={e => setFailureReason(e.target.value)}>
              <option value="">Select a reason...</option>
              {BREACH_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Start Date</label>
            <input className="fi" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>End Date (opt.)</label>
            <input className="fi" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Notes (optional)</label>
          <textarea className="fi" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Phase 1 passed, waiting on funded account..." />
        </div>

        <div style={{ marginTop: '12px', borderTop: '1px solid var(--brd)', paddingTop: '10px' }}>
          <button
            onClick={() => setRulesOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)' }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--txt2)' }}>Challenge Rules (optional)</span>
            <span style={{ fontSize: '11px', color: 'var(--txt3)', transform: rulesOpen ? 'rotate(180deg)' : 'none', transition: '.15s' }}>⌄</span>
          </button>

          {rulesOpen && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '10px' }}>
                Enter the firm's targets, then update your progress here whenever you check in. This is self-reported — Sleektrade isn't connected to the firm's platform.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px' }}>Profit Target ($)</label>
                  <input className="fi" type="number" value={profitTarget} onChange={e => setProfitTarget(e.target.value)} placeholder="3000" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px' }}>Current Profit ($)</label>
                  <input className="fi" type="number" value={currentProfit} onChange={e => setCurrentProfit(e.target.value)} placeholder="1800" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px' }}>Min Trading Days</label>
                  <input className="fi" type="number" value={minTradingDays} onChange={e => setMinTradingDays(e.target.value)} placeholder="10" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px' }}>Current Trading Days</label>
                  <input className="fi" type="number" value={currentTradingDays} onChange={e => setCurrentTradingDays(e.target.value)} placeholder="7" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px' }}>Max Daily Loss ($)</label>
                  <input className="fi" type="number" value={maxDailyLoss} onChange={e => setMaxDailyLoss(e.target.value)} placeholder="1500" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px' }}>Today's Daily Loss ($)</label>
                  <input className="fi" type="number" value={currentDailyLoss} onChange={e => setCurrentDailyLoss(e.target.value)} placeholder="400" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: 'var(--txt3)', marginBottom: '4px' }}>Max Drawdown ($)</label>
                  <input className="fi" type="number" value={maxDrawdown} onChange={e => setMaxDrawdown(e.target.value)} placeholder="2000" />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Add / Edit Transaction Modal */}
      <Modal
        open={txnModal}
        onClose={() => setTxnModal(false)}
        title={editingTxn ? 'Edit Transaction' : 'New Transaction'}
        width={460}
        footer={
          <>
            <button className="btn btn-o" onClick={() => setTxnModal(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSaveTxn} disabled={savingTxn}>{savingTxn ? 'Saving...' : editingTxn ? 'Save Changes' : 'Add Transaction'}</button>
          </>
        }
      >
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Amount</label>
          <input className="fi" type="number" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} placeholder="e.g. -150 for a fee, 1200 for a payout" autoFocus />
          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>Negative = fee, reset, or expense. Positive = payout received.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Category</label>
            <select className="fi" value={txnCategory} onChange={e => setTxnCategory(e.target.value as PropFirmTransactionRow['category'])}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Date</label>
            <input className="fi" type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Description (optional)</label>
          <input className="fi" value={txnDescription} onChange={e => setTxnDescription(e.target.value)} placeholder="e.g. Phase 1 reset" />
        </div>
      </Modal>
    </div>
  )
}
