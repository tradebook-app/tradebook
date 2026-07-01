'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { TradeRow, StrategyRow } from '@/lib/types'
import { insertStrategy } from '@/lib/strategyService'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (data: TradeFormPayload, screenshotFile: File | null) => Promise<void>
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
  pnl: number
  risk: number
  commission: number
  setup: string | null
  strategy_id: string | null
  grade: string | null
  tags: string[]
  notes: string | null
}

const GRADES = ['A+', 'A', 'A-', 'B', 'C']

export function AddTradeModal({ open, onClose, onSave, editTrade, strategies, userId, onStrategyCreated }: Props) {
  const [symbol,     setSymbol]     = useState('')
  const [side,       setSide]       = useState<'Long' | 'Short'>('Long')
  const [date,       setDate]       = useState('')
  const [exitDate,   setExitDate]   = useState('')
  const [entry,      setEntry]      = useState('')
  const [exit,       setExit]       = useState('')
  const [shares,     setShares]     = useState('')
  const [pnlOver,    setPnlOver]    = useState('')
  const [risk,       setRisk]       = useState('')
  const [commission, setCommission] = useState('')
  const [strategyId, setStrategyId] = useState('')
  const [legacySetup, setLegacySetup] = useState<string | null>(null)
  const [creatingStrategy, setCreatingStrategy] = useState(false)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [creatingStrategySaving, setCreatingStrategySaving] = useState(false)
  const [grade,      setGrade]      = useState('')
  const [tags,       setTags]       = useState<string[]>([])
  const [tagInput,   setTagInput]   = useState('')
  const [notes,      setNotes]      = useState('')
  const [imgPreview, setImgPreview] = useState<string | null>(null)
  const [imgFile,    setImgFile]    = useState<File | null>(null)
  const [saving,     setSaving]     = useState(false)

  const symRef = useRef<HTMLInputElement>(null)

  // Populate form when editing
  useEffect(() => {
    if (editTrade) {
      setSymbol(editTrade.symbol)
      setSide(editTrade.type as 'Long' | 'Short')
      setDate(editTrade.date ? editTrade.date.substring(0, 16) : '')
      setExitDate(editTrade.exit_date ? editTrade.exit_date.substring(0, 16) : '')
      setEntry(editTrade.entry ? String(editTrade.entry) : '')
      setExit(editTrade.exit ? String(editTrade.exit) : '')
      setShares(editTrade.shares ? String(editTrade.shares) : '')
      setPnlOver(String(editTrade.pnl))
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
      setGrade(editTrade.grade || '')
      setTags(editTrade.tags || [])
      setNotes(editTrade.notes || '')
      setImgPreview(null)
      setImgFile(null)
    } else {
      resetForm()
    }
  }, [editTrade, open, strategies])

  // Focus symbol input when modal opens
  useEffect(() => {
    if (open) setTimeout(() => symRef.current?.focus(), 80)
  }, [open])

  function resetForm() {
    setSymbol(''); setSide('Long')
    setDate(new Date().toISOString().substring(0, 16))
    setExitDate(''); setEntry(''); setExit(''); setShares('')
    setPnlOver(''); setRisk(''); setCommission('')
    setStrategyId(''); setLegacySetup(null); setGrade(''); setTags([]); setTagInput('')
    setCreatingStrategy(false); setNewStrategyName('')
    setNotes(''); setImgPreview(null); setImgFile(null)
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
    const f = e.target.files?.[0]
    if (!f) return
    setImgFile(f)
    const reader = new FileReader()
    reader.onload = ev => setImgPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  // Calculate P&L from entry/exit/shares if not overridden
  function calcPnl(): number {
    if (pnlOver !== '') return parseFloat(pnlOver) || 0
    const en = parseFloat(entry) || 0
    const ex = parseFloat(exit) || 0
    const sh = parseFloat(shares) || 0
    if (!en || !ex || !sh) return 0
    const gross = (ex - en) * sh * (side === 'Short' ? -1 : 1)
    const comm  = parseFloat(commission) || 0
    return parseFloat((gross - comm).toFixed(2))
  }

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
      pnl:        calcPnl(),
      risk:       parseFloat(risk) || 0,
      commission: parseFloat(commission) || 0,
      setup:      selectedStrategy ? selectedStrategy.name : (legacySetup || null),
      strategy_id: strategyId || null,
      grade:      grade || null,
      tags,
      notes:      notes || null,
    }

    await onSave(payload, imgFile)
    setSaving(false)
    handleClose()
  }

  const fg: React.CSSProperties = { marginBottom: '12px' }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '9px', fontWeight: 600,
    color: 'var(--txt3)', textTransform: 'uppercase',
    letterSpacing: '.06em', marginBottom: '4px',
  }
  const row2: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px',
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
      {/* Symbol + Side */}
      <div style={row2}>
        <div>
          <label style={lbl}>Symbol</label>
          <input
            ref={symRef}
            className="fi"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="NVDA"
          />
        </div>
        <div>
          <label style={lbl}>Side</label>
          <select className="fi" value={side} onChange={e => setSide(e.target.value as 'Long' | 'Short')}>
            <option>Long</option>
            <option>Short</option>
          </select>
        </div>
      </div>

      {/* Dates */}
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

      {/* Entry / Exit */}
      <div style={row2}>
        <div>
          <label style={lbl}>Entry ($)</label>
          <input className="fi" type="number" value={entry} onChange={e => setEntry(e.target.value)}
            placeholder="0.00" style={{ fontFamily: 'var(--mono)' }} />
        </div>
        <div>
          <label style={lbl}>Exit ($)</label>
          <input className="fi" type="number" value={exit} onChange={e => setExit(e.target.value)}
            placeholder="0.00" style={{ fontFamily: 'var(--mono)' }} />
        </div>
      </div>

      {/* Shares / P&L override */}
      <div style={row2}>
        <div>
          <label style={lbl}>Shares</label>
          <input className="fi" type="number" value={shares} onChange={e => setShares(e.target.value)}
            placeholder="100" style={{ fontFamily: 'var(--mono)' }} />
        </div>
        <div>
          <label style={lbl}>P&L ($) Override</label>
          <input className="fi" type="number" value={pnlOver} onChange={e => setPnlOver(e.target.value)}
            placeholder={`Auto: ${calcPnl() >= 0 ? '+' : ''}${calcPnl().toFixed(2)}`}
            style={{ fontFamily: 'var(--mono)' }} />
        </div>
      </div>

      {/* Risk / Commission */}
      <div style={row2}>
        <div>
          <label style={lbl}>Risk 1R ($)</label>
          <input className="fi" type="number" value={risk} onChange={e => setRisk(e.target.value)}
            placeholder="150" style={{ fontFamily: 'var(--mono)' }} />
        </div>
        <div>
          <label style={lbl}>Commissions ($)</label>
          <input className="fi" type="number" value={commission} onChange={e => setCommission(e.target.value)}
            placeholder="0" style={{ fontFamily: 'var(--mono)' }} />
        </div>
      </div>

      {/* Setup / Grade */}
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
            <select
              className="fi"
              value={strategyId}
              onChange={e => {
                if (e.target.value === '__new__') { setCreatingStrategy(true); return }
                setStrategyId(e.target.value)
                if (e.target.value) setLegacySetup(null)
              }}
              style={{ fontSize: '11px' }}
            >
              <option value="">— No Strategy —</option>
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new__">+ New Strategy...</option>
            </select>
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
            placeholder={tags.length ? '' : 'breakout, gap...'}
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
          placeholder="Setup rationale, market context..."
        />
      </div>

      {/* Screenshot */}
      <div style={fg}>
        <label style={lbl}>Trade Screenshot</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="btn btn-o" style={{ cursor: 'pointer' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgChange} />
            📷 Upload Chart
          </label>
          {imgPreview && (
            <img src={imgPreview} style={{ height: '40px', borderRadius: '4px', border: '1px solid var(--brd)' }} />
          )}
          {!imgPreview && editTrade?.screenshot_url && (
            <span style={{ fontSize: '10px', color: 'var(--ac)' }}>✓ Screenshot saved</span>
          )}
          <button
            className="btn btn-o"
            style={{ fontSize: '10px', marginLeft: '4px' }}
            onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=${symbol || 'SPY'}`, '_blank')}
            type="button"
          >
            📊 TradingView
          </button>
        </div>
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
