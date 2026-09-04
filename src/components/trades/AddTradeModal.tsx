'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { TradeRow, StrategyRow } from '@/lib/types'
import { ASSET_TYPES, assetUnitLabel } from '@/lib/types'
import { futuresPointValue } from '@/lib/contractMultiplier'
import { insertStrategy } from '@/lib/strategyService'
import { getScreenshotUrl } from '@/lib/tradeService'
import { computeTradePnl } from '@/lib/analytics'
import { shouldPopulateForm } from '@/lib/tradeFormInit'
import { useAccounts } from '@/components/AccountProvider'

type Props = {
  open: boolean
  onClose: () => void
  // Resolves to whether the save actually persisted — a modal-closing save
  // that silently failed (RLS, network, etc.) looked identical to a
  // successful one, so failures went completely unnoticed.
  onSave: (data: TradeFormPayload, newScreenshots: File[]) => Promise<boolean>
  editTrade?: TradeRow | null
  strategies: StrategyRow[]
  userId: string
  onStrategyCreated: (strategy: StrategyRow) => void
}

export type TradeFormPayload = {
  symbol: string
  type: 'Long' | 'Short'
  date: string
  exit_date: string | null
  entry: number
  exit: number | null
  shares: number
  asset_type: 'stock' | 'option' | 'futures' | 'forex'
  pnl: number
  risk: number
  commission: number
  setup: string | null
  strategy_id: string | null
  account_id: string | null
  grade: string | null
  tags: string[]
  notes: string | null
  screenshot_urls: string[]   // existing screenshots kept by the user
  // True only when the user actually typed a value into the P&L Override
  // field. Lets effectivePnl() (analytics.ts) tell a deliberate manual
  // override apart from stale/computed data everywhere else.
  pnl_is_override: boolean
}

const GRADES = ['A+', 'A', 'A-', 'B', 'C']

export function AddTradeModal({ open, onClose, onSave, editTrade, strategies, userId, onStrategyCreated }: Props) {
  const { accounts } = useAccounts()
  const [symbol,     setSymbol]     = useState('')
  const [side,       setSide]       = useState<'Long' | 'Short'>('Long')
  const [date,       setDate]       = useState('')
  const [exitDate,   setExitDate]   = useState('')
  const [entry,      setEntry]      = useState('')
  const [exit,       setExit]       = useState('')
  const [shares,     setShares]     = useState('')
  const [assetType,  setAssetType]  = useState<TradeRow['asset_type']>('stock')
  const [pnlOver,    setPnlOver]    = useState('')
  const [risk,       setRisk]       = useState('')
  const [commission, setCommission] = useState('')
  const [strategyId, setStrategyId] = useState('')
  const [accountId,  setAccountId]  = useState('')
  const [legacySetup, setLegacySetup] = useState<string | null>(null)
  const [creatingStrategy, setCreatingStrategy] = useState(false)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [creatingStrategySaving, setCreatingStrategySaving] = useState(false)
  const [strategyOpen, setStrategyOpen] = useState(false)
  const strategyRef = useRef<HTMLDivElement>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const [grade,      setGrade]      = useState('')
  const [tags,       setTags]       = useState<string[]>([])
  const [tagInput,   setTagInput]   = useState('')
  const [notes,      setNotes]      = useState('')
  // Screenshots: `keptShots` are storage paths already on the trade; `newFiles`
  // are freshly picked File objects with matching data-URL previews.
  const [keptShots,  setKeptShots]  = useState<string[]>([])
  const [shotUrls,   setShotUrls]   = useState<Record<string, string>>({})
  const [newFiles,   setNewFiles]   = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [saving,     setSaving]     = useState(false)

  const symRef = useRef<HTMLInputElement>(null)

  // Populate the form ONCE per open (keyed to the trade being edited), not on
  // every render. Without this guard the effect also re-ran whenever the
  // `strategies` prop changed — and creating a strategy inline (+ New Strategy)
  // changes that prop, so the newly-selected strategy was immediately wiped
  // back to "— No Strategy —" and the trade saved with setup/strategy_id null.
  const populatedKey = useRef<string | null>(null)

  // Populate form when editing
  useEffect(() => {
    const { populate, nextKey } = shouldPopulateForm(populatedKey.current, open, editTrade?.id)
    populatedKey.current = nextKey
    if (!populate) return
    if (editTrade) {
      setSymbol(editTrade.symbol)
      setSide(editTrade.type as 'Long' | 'Short')
      setDate(editTrade.date ? editTrade.date.substring(0, 16) : '')
      setExitDate(editTrade.exit_date ? editTrade.exit_date.substring(0, 16) : '')
      setEntry(editTrade.entry ? String(editTrade.entry) : '')
      setExit(editTrade.exit ? String(editTrade.exit) : '')
      setShares(editTrade.shares ? String(editTrade.shares) : '')
      setAssetType(editTrade.asset_type || 'stock')
      // Only pre-fill the P&L *override* field when the stored value is a
      // genuine manual override — i.e. it can't be derived from the fills, or
      // it's a non-zero value that disagrees with them. A stored 0 that the
      // fills contradict is a data error, not an override: leave the field
      // blank so it recomputes from entry / exit / shares on save.
      {
        const computed = computeTradePnl(editTrade)
        const keepOverride = computed == null
          || (editTrade.pnl !== 0 && Math.abs(editTrade.pnl - computed) > 0.01)
        setPnlOver(keepOverride ? String(editTrade.pnl) : '')
      }
      setRisk(editTrade.risk ? String(editTrade.risk) : '')
      setCommission(editTrade.commission ? String(editTrade.commission) : '')
      if (editTrade.strategy_id) {
        setStrategyId(editTrade.strategy_id)
        setLegacySetup(null)
      } else if (editTrade.setup) {
        const match = strategies.find(s => s.name.trim().toLowerCase() === editTrade.setup!.trim().toLowerCase())
        if (match) { setStrategyId(match.id); setLegacySetup(null) }
        else { setStrategyId(''); setLegacySetup(editTrade.setup) }
      } else {
        setStrategyId(''); setLegacySetup(null)
      }
      setAccountId(editTrade.account_id || accounts.find(a => a.is_default)?.id || accounts[0]?.id || '')
      setGrade(editTrade.grade || '')
      setTags(editTrade.tags || [])
      setNotes(editTrade.notes || '')
      setKeptShots(editTrade.screenshot_urls?.length
        ? editTrade.screenshot_urls
        : (editTrade.screenshot_url ? [editTrade.screenshot_url] : []))
      setNewFiles([])
      setNewPreviews([])
    } else {
      resetForm()
    }
    // `strategies` is deliberately NOT a dependency — this must only run when
    // the modal opens or which trade is being edited changes (populatedKey
    // guards that), never when the strategies list itself changes mid-edit.
    // It used to also list `strategies`, so creating a strategy inline (which
    // changes that list) re-ran this whole block and reset the Strategy field
    // the user had just picked back to "— No Strategy —", saving the trade
    // with setup/strategy_id null. If `strategies` hasn't loaded yet when this
    // runs, the legacy-setup match below picks it up once it arrives — it's
    // guarded to never fire once a strategy is selected.
  }, [editTrade, open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Signed URLs for the screenshots already on the trade.
  useEffect(() => {
    keptShots.forEach(path => {
      if (!shotUrls[path]) {
        getScreenshotUrl(path).then(url => { if (url) setShotUrls(prev => ({ ...prev, [path]: url })) })
      }
    })
  }, [keptShots]) // eslint-disable-line react-hooks/exhaustive-deps

  // If the trade carried a legacy free-text setup and its matching strategy
  // only finished loading after the form was populated, link them up. This
  // only ever *sets* a strategy from an unlinked legacy label — it never
  // clears a selection the user just made, so it's safe to run on every
  // strategies change.
  useEffect(() => {
    if (!open || strategyId || !legacySetup) return
    const match = strategies.find(s => s.name.trim().toLowerCase() === legacySetup.trim().toLowerCase())
    if (match) { setStrategyId(match.id); setLegacySetup(null) }
  }, [strategies, open, strategyId, legacySetup])

  // Focus symbol input when modal opens
  useEffect(() => {
    if (open) setTimeout(() => symRef.current?.focus(), 80)
  }, [open])

  // Native <select> was triggering a GPU rendering glitch (visible zigzag
  // artifact) in Chromium browsers when the popup opened — same root cause
  // as the fix already applied to the futures Contract picker. Custom
  // dropdown removes the native OS popup layer entirely.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (strategyRef.current && !strategyRef.current.contains(e.target as Node)) {
        setStrategyOpen(false)
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function resetForm() {
    setSymbol(''); setSide('Long')
    setDate(new Date().toISOString().substring(0, 16))
    setExitDate(''); setEntry(''); setExit(''); setShares(''); setAssetType('stock')
    setPnlOver(''); setRisk(''); setCommission('')
    setStrategyId(''); setLegacySetup(null); setGrade(''); setTags([]); setTagInput('')
    setAccountId(accounts.find(a => a.is_default)?.id || accounts[0]?.id || '')
    setCreatingStrategy(false); setNewStrategyName('')
    setNotes(''); setKeptShots([]); setNewFiles([]); setNewPreviews([])
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function addTag(val: string) {
    const v = val.trim().replace(/,/g, '')
    if (v && !tags.includes(v)) setTags(t => [...t, v])
    setTagInput('')
  }

  function removeTag(i: number) {
    setTags(t => t.filter((_, idx) => idx !== i))
  }

  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
    if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(t => t.slice(0, -1))
    }
  }

  async function handleCreateStrategy() {
    const name = newStrategyName.trim()
    if (!name) return
    setCreatingStrategySaving(true)
    const created = await insertStrategy({ name, rules: null, img_url: null }, userId)
    setCreatingStrategySaving(false)
    if (created) {
      onStrategyCreated(created)
      setStrategyId(created.id)
      setLegacySetup(null)
      setCreatingStrategy(false)
      setNewStrategyName('')
    } else {
      alert('Could not create the strategy — try again.')
    }
  }

  function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''  // let the same file be re-picked later
    if (!files.length) return
    setNewFiles(prev => [...prev, ...files])
    files.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => setNewPreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  function removeKeptShot(path: string) {
    setKeptShots(prev => prev.filter(p => p !== path))
  }
  function removeNewFile(i: number) {
    setNewFiles(prev => prev.filter((_, idx) => idx !== i))
    setNewPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  // Calculate P&L from entry/exit/shares if not overridden. Delegates to the
  // same computeTradePnl() used everywhere else (analytics.ts) rather than
  // reimplementing the multiplier logic here — that reimplementation is what
  // let this live-preview silently skip the forex lot-size multiplier while
  // computeTradePnl had it. Returns 0 for an incomplete/undeterminable trade
  // (open position, or an unrecognized futures/forex symbol) — the same as
  // the old behavior — since this is just a live preview, not the value that
  // gets saved (handleSave always calls computeTradePnl itself).
  function calcPnl(): number {
    if (pnlOver !== '') return parseFloat(pnlOver) || 0
    const computed = computeTradePnl({
      entry: parseFloat(entry) || 0,
      exit: parseFloat(exit) || null,
      shares: parseFloat(shares) || 0,
      type: side,
      asset_type: assetType,
      symbol,
      commission: parseFloat(commission) || 0,
    })
    return computed ?? 0
  }

  const futuresPointUnknown = assetType === 'futures' && symbol.trim() !== '' && futuresPointValue(symbol) === null

  async function handleSave() {
    if (!symbol.trim()) return alert('Enter a symbol')
    setSaving(true)

    const selectedStrategy = strategies.find(s => s.id === strategyId)

    const payload: TradeFormPayload = {
      symbol:     symbol.trim().toUpperCase(),
      type:       side,
      date:       date || new Date().toISOString(),
      exit_date:  exitDate || null,
      entry:      parseFloat(entry) || 0,
      exit:       parseFloat(exit) || null,
      shares:     parseFloat(shares) || 0,
      asset_type: assetType,
      pnl:        calcPnl(),
      risk:       parseFloat(risk) || 0,
      commission: parseFloat(commission) || 0,
      setup:      selectedStrategy ? selectedStrategy.name : (legacySetup || null),
      strategy_id: strategyId || null,
      account_id: accountId || null,
      grade:      grade || null,
      tags,
      notes:      notes || null,
      screenshot_urls: keptShots,
      // Only true when the user actually typed something into the P&L
      // Override field — not merely because it was pre-filled on open (see
      // the edit-populate effect above, which only pre-fills it for a
      // genuine override to begin with).
      pnl_is_override: pnlOver !== '',
    }

    const ok = await onSave(payload, newFiles)
    setSaving(false)
    if (ok) {
      handleClose()
    } else {
      // Keep the modal open with everything the user entered intact — a
      // failed save used to close the modal exactly like a successful one,
      // so the failure (and the user's edits) just silently vanished.
      alert('Could not save this trade — please try again.')
    }
  }

  const fg: React.CSSProperties = { marginBottom: '12px' }
  const ssRemoveBtn: React.CSSProperties = {
    position: 'absolute', top: '-6px', right: '-6px',
    width: '18px', height: '18px', borderRadius: '50%',
    background: 'var(--red)', color: '#fff', border: '2px solid var(--bg2)',
    fontSize: '9px', lineHeight: 1, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 0,
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '9px', fontWeight: 600,
    color: 'var(--txt3)', textTransform: 'uppercase',
    letterSpacing: '.06em', marginBottom: '4px',
  }
  const row2: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px',
  }
  const sectionHeader: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700, color: 'var(--txt3)',
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px',
  }
  const divider: React.CSSProperties = {
    borderTop: '1px solid var(--brd)', margin: '18px 0',
  }
  function segBtn(active: boolean, activeColor = 'var(--ac)'): React.CSSProperties {
    return {
      flex: 1, padding: '9px 4px', borderRadius: 'var(--r)',
      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
      fontFamily: 'var(--sans)', transition: '.1s',
      border: `1px solid ${active ? activeColor : 'var(--brd2)'}`,
      background: active ? `${activeColor}22` : 'var(--bg4)',
      color: active ? activeColor : 'var(--txt3)',
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editTrade ? `Edit Trade — ${editTrade.symbol}` : 'Log a Trade'}
      footer={
        <>
          <button className="btn btn-o" onClick={handleClose}>Cancel</button>
          <button className="btn btn-p" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Trade'}
          </button>
        </>
      }
    >
      {/* Trade Details */}
      <div style={sectionHeader}>Trade Details</div>
      <div style={row2}>
        <div>
          <label style={lbl}>Symbol</label>
          <input
            ref={symRef}
            className="fi"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label style={lbl}>Side</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => setSide('Long')} style={segBtn(side === 'Long', 'var(--ac)')}>Long</button>
            <button type="button" onClick={() => setSide('Short')} style={segBtn(side === 'Short', 'var(--red)')}>Short</button>
          </div>
        </div>
      </div>

      <div style={row2}>
        <div>
          <label style={lbl}>Entry Date & Time</label>
          <input className="fi" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Exit Date & Time</label>
          <input className="fi" type="datetime-local" value={exitDate} onChange={e => setExitDate(e.target.value)} />
        </div>
      </div>

      <div style={row2}>
        <div>
          <label style={lbl}>Entry ($)</label>
          <input className="fi" type="number" value={entry} onChange={e => setEntry(e.target.value)}
            style={{ fontFamily: 'var(--mono)' }} />
        </div>
        <div>
          <label style={lbl}>Exit ($)</label>
          <input className="fi" type="number" value={exit} onChange={e => setExit(e.target.value)}
            style={{ fontFamily: 'var(--mono)' }} />
        </div>
      </div>

      <div style={divider} />

      {/* Asset Type */}
      <div style={sectionHeader}>Asset Type</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
        {ASSET_TYPES.map(a => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAssetType(a.value)}
            style={segBtn(assetType === a.value, 'var(--ac)')}
          >{a.label}</button>
        ))}
      </div>

      {futuresPointUnknown && (
        <div style={{ fontSize: '10px', color: 'var(--orange, #F59E0B)', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: '12px' }}>
          ⚠️ We don't recognize "{symbol.trim().toUpperCase()}" as a futures contract, so we can't calculate its point value automatically. Enter the exact dollar P&amp;L in the override field below instead of relying on auto-calc.
        </div>
      )}

      <div style={row2}>
        <div>
          <label style={lbl}>{assetUnitLabel(assetType)}</label>
          <input className="fi" type="number" value={shares} onChange={e => setShares(e.target.value)}
            style={{ fontFamily: 'var(--mono)' }} />
        </div>
        <div>
          <label style={lbl}>P&L ($) Override</label>
          <input className="fi" type="number" value={pnlOver} onChange={e => setPnlOver(e.target.value)}
            placeholder="Auto-calculated"
            style={{ fontFamily: 'var(--mono)' }} />
        </div>
      </div>

      {/* Trading Account — only shown if the user has more than one */}
      {accounts.length > 1 && (
        <div style={fg}>
          <label style={lbl}>Trading Account</label>
          <div ref={accountRef} style={{ position: 'relative' }}>
            <div onClick={() => setAccountOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg4, #16161e)', border: '1px solid var(--brd2, #2a2a35)',
              borderRadius: 'var(--r)', padding: '8px 11px', fontSize: '11px', color: 'var(--txt)',
              cursor: 'pointer', userSelect: 'none',
            }}>
              <span>{accounts.find(a => a.id === accountId)?.name ?? 'Select account'}</span>
              <span style={{ color: 'var(--txt3)', fontSize: '9px' }}>{accountOpen ? '▴' : '▾'}</span>
            </div>
            {accountOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                background: '#141419', border: '1px solid var(--brd)', borderRadius: 'var(--r)',
                maxHeight: '220px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
              }}>
                {accounts.map(a => (
                  <div key={a.id} onClick={() => { setAccountId(a.id); setAccountOpen(false) }} style={{
                    padding: '8px 12px', fontSize: '11px', cursor: 'pointer',
                    background: a.id === accountId ? 'var(--bg4, #21212E)' : 'transparent',
                    color: a.id === accountId ? 'var(--txt)' : 'var(--txt2)',
                    fontWeight: a.id === accountId ? 700 : 400,
                  }}>{a.name}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={divider} />

      {/* Risk & Cost */}
      <div style={sectionHeader}>Risk &amp; Cost</div>
      <div style={row2}>
        <div>
          <label style={lbl}>Risk 1R ($)</label>
          <input className="fi" type="number" value={risk} onChange={e => setRisk(e.target.value)}
            style={{ fontFamily: 'var(--mono)' }} />
        </div>
        <div>
          <label style={lbl}>Commissions ($)</label>
          <input className="fi" type="number" value={commission} onChange={e => setCommission(e.target.value)}
            style={{ fontFamily: 'var(--mono)' }} />
        </div>
      </div>

      <div style={divider} />

      {/* Context */}
      <div style={sectionHeader}>Context</div>
      <div style={row2}>
        <div>
          <label style={lbl}>Strategy</label>
          {creatingStrategy ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                className="fi"
                autoFocus
                value={newStrategyName}
                onChange={e => setNewStrategyName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateStrategy() } if (e.key === 'Escape') setCreatingStrategy(false) }}
                placeholder="New strategy name..."
                style={{ fontSize: '11px' }}
              />
              <button
                type="button"
                className="btn btn-p"
                style={{ fontSize: '10px', padding: '0 12px', flexShrink: 0 }}
                onClick={handleCreateStrategy}
                disabled={creatingStrategySaving || !newStrategyName.trim()}
              >{creatingStrategySaving ? '...' : 'Add'}</button>
              <button
                type="button"
                className="btn btn-o"
                style={{ fontSize: '10px', padding: '0 10px', flexShrink: 0 }}
                onClick={() => { setCreatingStrategy(false); setNewStrategyName('') }}
              >✕</button>
            </div>
          ) : (
            <div ref={strategyRef} style={{ position: 'relative' }}>
              <div onClick={() => setStrategyOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg4, #16161e)', border: '1px solid var(--brd2, #2a2a35)',
                borderRadius: 'var(--r)', padding: '8px 11px', fontSize: '11px', color: 'var(--txt)',
                cursor: 'pointer', userSelect: 'none',
              }}>
                <span>{strategies.find(s => s.id === strategyId)?.name ?? '— No Strategy —'}</span>
                <span style={{ color: 'var(--txt3)', fontSize: '9px' }}>{strategyOpen ? '▴' : '▾'}</span>
              </div>
              {strategyOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                  background: '#141419', border: '1px solid var(--brd)', borderRadius: 'var(--r)',
                  maxHeight: '220px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                }}>
                  <div onClick={() => { setStrategyId(''); setStrategyOpen(false) }} style={{
                    padding: '8px 12px', fontSize: '11px', cursor: 'pointer',
                    background: strategyId === '' ? 'var(--bg4, #21212E)' : 'transparent',
                    color: strategyId === '' ? 'var(--txt)' : 'var(--txt2)',
                    fontWeight: strategyId === '' ? 700 : 400,
                  }}>— No Strategy —</div>
                  {strategies.map(s => (
                    <div key={s.id} onClick={() => { setStrategyId(s.id); setLegacySetup(null); setStrategyOpen(false) }} style={{
                      padding: '8px 12px', fontSize: '11px', cursor: 'pointer',
                      background: s.id === strategyId ? 'var(--bg4, #21212E)' : 'transparent',
                      color: s.id === strategyId ? 'var(--txt)' : 'var(--txt2)',
                      fontWeight: s.id === strategyId ? 700 : 400,
                    }}>{s.name}</div>
                  ))}
                  <div onClick={() => { setCreatingStrategy(true); setStrategyOpen(false) }} style={{
                    padding: '8px 12px', fontSize: '11px', cursor: 'pointer', color: 'var(--ac)',
                    borderTop: '1px solid var(--brd)',
                  }}>+ New Strategy...</div>
                </div>
              )}
            </div>
          )}
          {legacySetup && !strategyId && !creatingStrategy && (
            <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>
              Previously tagged &ldquo;{legacySetup}&rdquo; — no strategy matches that. Pick one above to link it, or leave as-is to keep the old label.
            </div>
          )}
        </div>
        <div>
          <label style={lbl}>Grade</label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {GRADES.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(grade === g ? '' : g)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--r)',
                  fontSize: '10px', fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid var(--brd2)',
                  background: grade === g ? 'var(--ac-d)' : 'var(--bg4)',
                  color: grade === g ? 'var(--ac2)' : 'var(--txt3)',
                  fontFamily: 'var(--sans)',
                  transition: '.1s',
                }}
              >{g}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div style={fg}>
        <label style={lbl}>Tags (press Enter)</label>
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '3px',
            background: 'var(--bg4)', border: '1px solid var(--brd2)',
            borderRadius: 'var(--r)', padding: '5px 7px', minHeight: '34px',
            cursor: 'text',
          }}
          onClick={() => document.getElementById('tag-input')?.focus()}
        >
          {tags.map((t, i) => (
            <span key={i} style={{
              display: 'flex', alignItems: 'center', gap: '2px',
              background: 'var(--bg5)', border: '1px solid var(--brd2)',
              borderRadius: '3px', padding: '1px 5px',
              fontSize: '9px', color: 'var(--txt2)',
            }}>
              {t}
              <button
                onClick={() => removeTag(i)}
                style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '10px' }}
              >×</button>
            </span>
          ))}
          <input
            id="tag-input"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKey}
            onBlur={() => tagInput && addTag(tagInput)}
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--txt)', fontSize: '10px',
              fontFamily: 'var(--sans)', minWidth: '60px',
            }}
          />
        </div>
      </div>

      {/* Notes */}
      <div style={fg}>
        <label style={lbl}>Notes</label>
        <textarea
          className="fi"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Screenshots */}
      <div style={fg}>
        <label style={lbl}>Trade Screenshots</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {keptShots.map(path => (
            <div key={path} style={{ position: 'relative' }}>
              {shotUrls[path]
                ? <img src={shotUrls[path]} alt="Trade screenshot" style={{ height: '52px', width: '78px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--brd)' }} />
                : <div style={{ height: '52px', width: '78px', borderRadius: '4px', border: '1px solid var(--brd)', background: 'var(--bg4)' }} />}
              <button type="button" onClick={() => removeKeptShot(path)} aria-label="Remove screenshot"
                style={ssRemoveBtn}>✕</button>
            </div>
          ))}
          {newPreviews.map((src, i) => (
            <div key={`new-${i}`} style={{ position: 'relative' }}>
              <img src={src} alt="New screenshot" style={{ height: '52px', width: '78px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--ac)' }} />
              <button type="button" onClick={() => removeNewFile(i)} aria-label="Remove screenshot"
                style={ssRemoveBtn}>✕</button>
            </div>
          ))}
          <label className="btn btn-o" style={{ cursor: 'pointer' }}>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgChange} />
            📷 Add {keptShots.length + newPreviews.length > 0 ? 'another' : 'chart'}
          </label>
        </div>
        <div style={{ fontSize: '9px', color: 'var(--txt3)', marginTop: '4px' }}>Add as many as you like — e.g. entry chart + exit chart.</div>
      </div>

      {/* P&L Preview */}
      {(entry || pnlOver) && (
        <div style={{
          background: 'var(--bg4)', borderRadius: 'var(--r)',
          padding: '10px 14px', marginTop: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>Estimated Net P&L</span>
          <span style={{
            fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)',
            color: calcPnl() >= 0 ? 'var(--ac)' : 'var(--red)',
          }}>
            {calcPnl() >= 0 ? '+' : ''}${calcPnl().toFixed(2)}
          </span>
        </div>
      )}
    </Modal>
  )
}