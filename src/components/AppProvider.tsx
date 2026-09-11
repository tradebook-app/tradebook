'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { AddTradeModal, type TradeFormPayload } from '@/components/trades/AddTradeModal'
import { TradeView } from '@/components/trades/TradeView'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { fetchStrategies } from '@/lib/strategyService'
import type { TradeRow, DateRangeFilter, StrategyRow, NoteRow } from '@/lib/types'
import {
  fetchTrades, insertTrade, updateTrade,
  deleteTrade, deleteTrades, uploadScreenshots, deleteScreenshots,
} from '@/lib/tradeService'
import {
  fetchNotes, insertNote, updateNote, deleteNote, uploadNoteImage, isNoteInAccount,
} from '@/lib/noteService'
import { usePathname } from 'next/navigation'
import { BrokerImport } from '@/components/import/BrokerImport'
import { Reports } from '@/components/reports/Reports'
import { PositionSize } from '@/components/PositionSize'
import { Strategies } from '@/components/strategies/Strategies'
import { Notebook } from '@/components/notebook/Notebook'
import { PlanProvider, usePlan } from '@/components/PlanProvider'
import { AccountProvider, useAccounts } from '@/components/AccountProvider'
import { UpgradeWall, UpgradeBanner } from '@/components/UpgradeWall'
import { Settings } from '@/components/Settings'
import { ReferralsPage } from '@/components/ReferralsPage'
import { Journal } from '@/components/Journal'
import { AIAnalysis } from '@/components/AIAnalysis'
import { Billing } from '@/components/Billing'
import { Scanner } from '@/components/Scanner'
import { PropTracker } from '@/components/proptracker/PropTracker'


type Props = {
  userId: string
  userEmail?: string
}

function GatedReports({ trades, filter }: { trades: any[], filter: any }) {
  const { isPro, loading } = usePlan()
  if (loading) return null
  if (!isPro) return <UpgradeWall feature="Full Reports - Pro Feature" description="Upgrade to Pro to unlock all 7 report tabs with 25+ performance metrics including Day and Time, Symbols, Risk/R-Multiple, Win vs Loss, and Setups." />
  return <Reports trades={trades} filter={filter} />
}

function GatedNotebook({ userId, onEdit, notes, trades, onSaveNote, onDeleteNote, onClearTradeNote }: any) {
  const { isPro, loading } = usePlan()
  if (loading) return null
  if (!isPro) return <UpgradeWall feature="Notebook - Pro Feature" description="Upgrade to Pro to unlock the Notebook and keep all your trade ideas, rules, and notes in one place." />
  return <Notebook onEdit={onEdit} notes={notes} trades={trades} onSaveNote={onSaveNote} onDeleteNote={onDeleteNote} onClearTradeNote={onClearTradeNote} />
}

function GatedStrategies({ userId, trades }: { userId: string, trades: TradeRow[] }) {
  const { isPro, loading } = usePlan()
  if (loading) return null
  if (!isPro) return <UpgradeWall feature="Strategies - Pro Feature" description="Upgrade to Pro to build and manage your trading strategies with full notes and screenshots." />
  return <Strategies userId={userId} trades={trades} />
}

function GatedImport({ userId, existingTrades, onImported }: { userId: string, existingTrades: any[], onImported: () => void }) {
  const { isPro, loading } = usePlan()
  if (loading) return null
  if (!isPro) return <UpgradeWall feature="Broker Import - Pro Feature" description="Upgrade to Pro to import your trades from DAS Trader, ThinkOrSwim, and more brokers coming soon." />
  return <BrokerImport userId={userId} existingTrades={existingTrades} onImported={onImported} />
}

function GatedAIAnalysis({ trades, userId }: { trades: any[], userId: string }) {
  const { isElite, loading } = usePlan()
  if (loading) return null
  if (!isElite) return <UpgradeWall feature="Sleek AI - Elite Feature" description="Upgrade to Elite to unlock AI-powered trade analysis. Get personalized insights, pattern detection, and coaching from your own trading data." tier="elite" />
  return <AIAnalysis trades={trades} userId={userId} />
}

function GatedScanner() {
  const { isElite, loading } = usePlan()
  if (loading) return null
  if (!isElite) return <UpgradeWall feature="Scanner - Elite Feature" description="Upgrade to Elite to unlock the full US-market Scanner with Momentum, Themes, and Fundamentals screening." tier="elite" />
  return <Scanner />
}

function GatedPropTracker({ userId }: { userId: string }) {
  const { isElite, loading } = usePlan()
  if (loading) return null
  if (!isElite) return <UpgradeWall feature="Prop Tracker - Elite Feature" description="Upgrade to Elite to track fees, resets, and payouts across every prop firm account and see your true net P&L and ROI." tier="elite" />
  return <PropTracker userId={userId} />
}

function DashboardWithBanner({ trades, filter, onEdit, onDelete, onRemoveScreenshot, userId, onReload }: any) {
  const { tradeCount, isPro } = usePlan()
  return (
    <div>
      {!isPro && <UpgradeBanner tradeCount={tradeCount} limit={50} />}
      <Dashboard trades={trades} filter={filter} onEdit={onEdit} onDelete={onDelete} onRemoveScreenshot={onRemoveScreenshot} userId={userId} onReload={onReload} />
    </div>
  )
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':     'Dashboard',
  '/trades':        'Trade View',
  '/journal':       'Journal',
  '/notebook':      'Notebook',
  '/reports':       'Reports',
  '/strategies':    'Strategies',
  '/scanner':       'Scanner',
  '/prop-tracker':  'Prop Tracker',
  '/position-size': 'Position Size',
  '/ai-analysis':   'Sleek AI',
  '/billing':       'Billing',
  '/import':        'Import Trades',
  '/settings':      'Settings',
  '/referrals':     'Refer & Earn',
}

// Pages whose trade/note lists should respect the account switcher in the
// topbar. Settings, Billing, Scanner, Strategies, Import, Position Size
// aren't account-scoped views, so they always get the unfiltered set.
// Strategies stays global across all accounts intentionally (confirmed).
const ACCOUNT_SCOPED_PAGES = new Set(['/dashboard', '/trades', '/journal', '/reports', '/ai-analysis', '/notebook'])

// Rendered INSIDE AccountProvider so it can read the selected account and
// filter trades/notes before anything downstream sees them. AppProvider
// itself can't do this directly since it sits above PlanProvider/AccountProvider.
function AppInner({
  pathname, title, trades, notes, loading, loadError, onRetryLoad, filter, setFilter, userId, userEmail,
  openAdd, openEdit, handleSave, handleDelete, handleDeleteMany, handleRemoveScreenshot, reloadTrades,
  onSaveNote, onDeleteNote, onClearTradeNote,
  modalOpen, setModalOpen, editTrade, setEditTrade, strategyList, setStrategyList,
}: any) {
  const { selectedAccountId } = useAccounts()

  const scopedTrades = (ACCOUNT_SCOPED_PAGES.has(pathname) && selectedAccountId)
    ? trades.filter((t: TradeRow) => t.account_id === selectedAccountId)
    : trades

  // See isNoteInAccount (noteService.ts): unlike trades, a note with no
  // account_id is shown under EVERY account rather than hidden.
  const scopedNotes = (ACCOUNT_SCOPED_PAGES.has(pathname) && selectedAccountId)
    ? notes.filter((n: NoteRow) => isNoteInAccount(n, selectedAccountId))
    : notes

  function renderPage() {
    // A failed initial load used to leave "loading" true forever (see
    // tradeService.ts's fetchTrades) — an infinite spinner with no error and
    // no way to recover short of a hard page reload. Now it resolves to a
    // visible error with a retry action instead.
    if (loadError && pathname !== '/scanner') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '10px', color: 'var(--txt3)' }}>
          <div style={{ fontSize: '13px', color: 'var(--txt2)' }}>Couldn't load your data — check your connection and try again.</div>
          <button className="btn btn-o" onClick={onRetryLoad}>Retry</button>
        </div>
      )
    }
    if (loading && pathname !== '/scanner') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--txt3)' }}>
          Loading...
        </div>
      )
    }

    if (pathname === '/scanner')      return <GatedScanner />
    if (pathname === '/trades')       return <TradeView trades={scopedTrades} filter={filter} onFilterChange={setFilter} onEdit={openEdit} onDelete={handleDelete} onDeleteFiltered={handleDeleteMany} onRemoveScreenshot={handleRemoveScreenshot} />
    if (pathname === '/dashboard')    return <DashboardWithBanner trades={scopedTrades} filter={filter} onEdit={openEdit} onDelete={handleDelete} onRemoveScreenshot={handleRemoveScreenshot} userId={userId} onReload={reloadTrades} />
    if (pathname === '/journal')      return <Journal trades={scopedTrades} onEdit={openEdit} onDelete={handleDelete} />
    if (pathname === '/reports')      return <GatedReports trades={scopedTrades} filter={filter} />
    if (pathname === '/position-size')return <PositionSize />
    if (pathname === '/strategies')   return <GatedStrategies userId={userId} trades={trades} />
    if (pathname === '/notebook')     return <GatedNotebook userId={userId} onEdit={openEdit} notes={scopedNotes} trades={scopedTrades} onSaveNote={onSaveNote} onDeleteNote={onDeleteNote} onClearTradeNote={onClearTradeNote} />
    if (pathname === '/import')       return <GatedImport userId={userId} existingTrades={trades} onImported={reloadTrades} />
    if (pathname === '/settings')     return <Settings userEmail={userEmail} />
    if (pathname === '/referrals')    return <ReferralsPage />
    if (pathname === '/ai-analysis')  return <GatedAIAnalysis trades={scopedTrades} userId={userId} />
    if (pathname === '/prop-tracker') return <GatedPropTracker userId={userId} />
    if (pathname === '/billing')      return <Billing />

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px' }}>
        <div style={{ fontSize: '32px' }}>🚧</div>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>Coming soon</div>
        <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>This section is being built in the next phase.</div>
      </div>
    )
  }

  return (
    <>
      <AppShell title={title} userEmail={userEmail} filter={filter} onFilterChange={setFilter} onAddTrade={openAdd}>
        {renderPage()}
      </AppShell>
      <AddTradeModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTrade(null) }}
        onSave={handleSave}
        editTrade={editTrade}
        strategies={strategyList}
        userId={userId}
        onStrategyCreated={(s: StrategyRow) => setStrategyList((prev: StrategyRow[]) => [s, ...prev])}
      />
    </>
  )
}

export function AppProvider({ userId, userEmail }: Props) {
  const pathname = usePathname()

  const [trades,    setTrades]    = useState<TradeRow[]>([])
  const [notes,     setNotes]     = useState<NoteRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTrade, setEditTrade] = useState<TradeRow | null>(null)
  const [filter,    setFilter]    = useState<DateRangeFilter>({ range: 'all' })
  const [strategyList, setStrategyList] = useState<StrategyRow[]>([])

  // Loads both trades and notes behind the one "loading"/"loadError" gate —
  // Notebook needs both (manual notes + trade-derived note cards) and, like
  // every other account-scoped page, now just receives them pre-loaded as
  // props instead of fetching its own copy.
  function loadData() {
    setLoading(true)
    setLoadError(false)
    Promise.all([fetchTrades(), fetchNotes()]).then(([tradesData, notesData]) => {
      setTrades(tradesData)
      setNotes(notesData)
      setLoading(false)
    }).catch(err => {
      // Belt-and-suspenders: fetchTrades() itself no longer throws (see
      // tradeService.ts), but this guarantees the app can never get stuck on
      // "Loading..." forever even if something upstream of it does.
      console.error('Failed to load trades/notes:', err)
      setLoading(false)
      setLoadError(true)
    })
  }

  useEffect(() => {
    loadData()
    fetchStrategies().then(setStrategyList)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === 'n' && !e.ctrlKey && !e.metaKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        setEditTrade(null)
        setModalOpen(true)
        fetchStrategies().then(setStrategyList)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function openAdd() { setEditTrade(null); setModalOpen(true); fetchStrategies().then(setStrategyList) }
  function openEdit(trade: TradeRow) { setEditTrade(trade); setModalOpen(true); fetchStrategies().then(setStrategyList) }

  // Returns whether the save actually persisted, so the modal can tell the user
  // when it silently failed (bad RLS, network hiccup, etc.) instead of closing
  // as if it worked. Previously the caller never checked this.
  async function handleSave(payload: TradeFormPayload, newScreenshots: File[]): Promise<boolean> {
    // payload.screenshot_urls = the existing screenshots the user kept.
    const kept = payload.screenshot_urls ?? []
    const uploaded = newScreenshots.length ? await uploadScreenshots(newScreenshots, userId) : []
    const screenshot_urls = [...kept, ...uploaded]

    // Clean up screenshots the user removed from an existing trade.
    if (editTrade?.screenshot_urls?.length) {
      const removed = editTrade.screenshot_urls.filter(p => !kept.includes(p))
      if (removed.length) deleteScreenshots(removed)  // fire and forget
    }

    const tradeData = {
      ...payload,
      screenshot_urls,
      screenshot_url: screenshot_urls[0] ?? null,   // keep the legacy column in sync
      trade_group_id: editTrade ? editTrade.trade_group_id : null,
    }
    if (editTrade) {
      const updated = await updateTrade(editTrade.id, tradeData)
      if (!updated) return false
      setTrades(prev => prev.map(t => t.id === editTrade.id ? updated : t))
      return true
    } else {
      const inserted = await insertTrade(tradeData, userId)
      if (!inserted) return false
      setTrades(prev => [inserted, ...prev])
      return true
    }
  }

  async function handleDelete(id: string) {
    const ok = await deleteTrade(id)
    if (ok) setTrades(prev => prev.filter(t => t.id !== id))
  }

  async function handleRemoveScreenshot(tradeId: string, path: string) {
    const t = trades.find(x => x.id === tradeId)
    if (!t) return
    const remaining = (t.screenshot_urls || []).filter(p => p !== path)
    const updated = await updateTrade(tradeId, { screenshot_urls: remaining, screenshot_url: remaining[0] ?? null })
    if (!updated) throw new Error('Failed to remove screenshot')
    setTrades(prev => prev.map(x => x.id === tradeId ? updated : x))
    deleteScreenshots([path]) // best effort, once the row no longer references it
  }

  async function handleDeleteMany(ids: string[]) {
    const ok = await deleteTrades(ids)
    if (ok) {
      const idSet = new Set(ids)
      setTrades(prev => prev.filter(t => !idSet.has(t.id)))
    }
  }

  async function reloadTrades() {
    const data = await fetchTrades()
    setTrades(data)
  }

  // Mirrors handleSave for trades: the leaf component (Notebook) collects
  // form state + the raw image File and an accountId (from its own
  // useAccounts(), same as AddTradeModal does for trades) and hands them up;
  // this does the upload + insert/update + state update. accountId is only
  // ever applied on INSERT — editing an existing note never reassigns it to
  // whatever account happens to be selected at edit time.
  async function handleSaveNote(
    payload: { title: string; body: string; category: 'trade' | 'my'; existingImgUrl: string | null; editingId: string | null; accountId: string | null },
    imgFile: File | null,
  ): Promise<boolean> {
    let imgUrl = payload.existingImgUrl
    if (imgFile) {
      const uploaded = await uploadNoteImage(imgFile, userId)
      if (uploaded) imgUrl = uploaded
      else alert('Could not upload the image — the note will keep its previous image.')
    }
    if (payload.editingId) {
      const updated = await updateNote(payload.editingId, { title: payload.title, body: payload.body, category: payload.category, img_url: imgUrl })
      if (!updated) return false
      setNotes(prev => prev.map(n => n.id === payload.editingId ? updated : n))
      return true
    } else {
      const inserted = await insertNote({ title: payload.title, body: payload.body, category: payload.category, img_url: imgUrl, account_id: payload.accountId }, userId)
      if (!inserted) return false
      setNotes(prev => [inserted, ...prev])
      return true
    }
  }

  async function handleDeleteNote(id: string) {
    const ok = await deleteNote(id)
    if (ok) setNotes(prev => prev.filter(n => n.id !== id))
  }

  // "Deleting" a trade-derived note card doesn't delete the trade — it clears
  // the notes text and screenshots on that trade, which is what put the card
  // in the Notebook in the first place. The trade and its P&L stay intact.
  async function handleClearTradeNote(trade: TradeRow) {
    const updated = await updateTrade(trade.id, { notes: null, screenshot_url: null, screenshot_urls: [] })
    if (updated) setTrades(prev => prev.map(t => t.id === trade.id ? updated : t))
  }

  const title = PAGE_TITLES[pathname] || 'Sleektrade'

  return (
    <PlanProvider>
      <AccountProvider>
        <AppInner
          pathname={pathname} title={title} trades={trades} notes={notes} loading={loading}
          loadError={loadError} onRetryLoad={loadData}
          filter={filter} setFilter={setFilter} userId={userId} userEmail={userEmail}
          openAdd={openAdd} openEdit={openEdit} handleSave={handleSave}
          handleDelete={handleDelete} handleDeleteMany={handleDeleteMany}
          handleRemoveScreenshot={handleRemoveScreenshot} reloadTrades={reloadTrades}
          onSaveNote={handleSaveNote} onDeleteNote={handleDeleteNote} onClearTradeNote={handleClearTradeNote}
          modalOpen={modalOpen} setModalOpen={setModalOpen} editTrade={editTrade} setEditTrade={setEditTrade}
          strategyList={strategyList} setStrategyList={setStrategyList}
        />
      </AccountProvider>
    </PlanProvider>
  )
}