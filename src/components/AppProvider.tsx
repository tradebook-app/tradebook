'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { AddTradeModal, type TradeFormPayload } from '@/components/trades/AddTradeModal'
import { TradeView } from '@/components/trades/TradeView'
import { Dashboard } from '@/components/dashboard/Dashboard'
import type { TradeRow, DateRangeFilter } from '@/lib/types'
import {
  fetchTrades, insertTrade, updateTrade,
  deleteTrade, deleteTrades, uploadScreenshot,
} from '@/lib/tradeService'
import { usePathname } from 'next/navigation'
import { BrokerImport } from '@/components/import/BrokerImport'
import { Reports } from '@/components/reports/Reports'
import { PositionSize } from '@/components/PositionSize'
import { Strategies } from '@/components/strategies/Strategies'
import { Notebook } from '@/components/notebook/Notebook'
import { PlanProvider, usePlan } from '@/components/PlanProvider'
import { UpgradeWall, UpgradeBanner } from '@/components/UpgradeWall'
import { Settings } from '@/components/Settings'
import { Journal } from '@/components/Journal'
import { AIAnalysis } from '@/components/AIAnalysis'
import { Billing } from '@/components/Billing'

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

function GatedNotebook({ userId }: { userId: string }) {
  const { isPro, loading } = usePlan()
  if (loading) return null
  if (!isPro) return <UpgradeWall feature="Notebook - Pro Feature" description="Upgrade to Pro to unlock the Notebook and keep all your trade ideas, rules, and notes in one place." />
  return <Notebook userId={userId} />
}

function GatedStrategies({ userId }: { userId: string }) {
  const { isPro, loading } = usePlan()
  if (loading) return null
  if (!isPro) return <UpgradeWall feature="Strategies - Pro Feature" description="Upgrade to Pro to build and manage your trading strategies with full notes and screenshots." />
  return <Strategies userId={userId} />
}

function GatedImport({ userId, existingTrades, onImported }: { userId: string, existingTrades: any[], onImported: () => void }) {
  const { isPro, loading } = usePlan()
  if (loading) return null
  if (!isPro) return <UpgradeWall feature="Broker Import - Pro Feature" description="Upgrade to Pro to import your trades from DAS Trader, ThinkOrSwim, and more brokers coming soon." />
  return <BrokerImport userId={userId} existingTrades={existingTrades} onImported={onImported} />
}

function GatedAIAnalysis({ trades }: { trades: any[] }) {
  const { isPro, loading } = usePlan()
  if (loading) return null
  if (!isPro) return <UpgradeWall feature="Sleek AI - Elite Feature" description="Upgrade to Elite to unlock AI-powered trade analysis. Get personalized insights, pattern detection, and coaching from your own trading data." />
  return <AIAnalysis trades={trades} />
}

function DashboardWithBanner({ trades, filter, onEdit, onDelete, userId, onReload }: any) {
  const { tradeCount, isPro } = usePlan()
  return (
    <div>
      {!isPro && <UpgradeBanner tradeCount={tradeCount} limit={50} />}
      <Dashboard trades={trades} filter={filter} onEdit={onEdit} onDelete={onDelete} userId={userId} onReload={onReload} />
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
  '/position-size': 'Position Size',
  '/ai-analysis':   'Sleek AI',
  '/billing':       'Billing',
  '/import':        'Import Trades',
  '/settings':      'Settings',
}

export function AppProvider({ userId, userEmail }: Props) {
  const pathname = usePathname()

  const [trades,    setTrades]    = useState<TradeRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTrade, setEditTrade] = useState<TradeRow | null>(null)
  const [filter,    setFilter]    = useState<DateRangeFilter>({ range: 'all' })

  useEffect(() => {
    fetchTrades().then(data => {
      setTrades(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === 'n' && !e.ctrlKey && !e.metaKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        setEditTrade(null)
        setModalOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function openAdd() { setEditTrade(null); setModalOpen(true) }
  function openEdit(trade: TradeRow) { setEditTrade(trade); setModalOpen(true) }

  async function handleSave(payload: TradeFormPayload, screenshotFile: File | null) {
    let screenshotUrl: string | null = editTrade?.screenshot_url || null
    if (screenshotFile) screenshotUrl = await uploadScreenshot(screenshotFile, userId)
    const tradeData = { ...payload, screenshot_url: screenshotUrl }
    if (editTrade) {
      const updated = await updateTrade(editTrade.id, tradeData)
      if (updated) setTrades(prev => prev.map(t => t.id === editTrade.id ? updated : t))
    } else {
      const inserted = await insertTrade(tradeData, userId)
      if (inserted) setTrades(prev => [inserted, ...prev])
    }
  }

  async function handleDelete(id: string) {
    const ok = await deleteTrade(id)
    if (ok) setTrades(prev => prev.filter(t => t.id !== id))
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

  const strategies = Array.from(new Set(trades.map(t => t.setup).filter((x) => Boolean(x)))).sort()
  const title = PAGE_TITLES[pathname] || 'Sleektrade'

  function renderPage() {
    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--txt3)' }}>
          Loading...
        </div>
      )
    }

    if (pathname === '/trades') return <TradeView trades={trades} filter={filter} onEdit={openEdit} onDelete={handleDelete} onDeleteFiltered={handleDeleteMany} />
    if (pathname === '/dashboard') return <DashboardWithBanner trades={trades} filter={filter} onEdit={openEdit} onDelete={handleDelete} userId={userId} onReload={reloadTrades} />
    if (pathname === '/journal') return <Journal trades={trades} onEdit={openEdit} />
    if (pathname === '/reports') return <GatedReports trades={trades} filter={filter} />
    if (pathname === '/position-size') return <PositionSize />
    if (pathname === '/strategies') return <GatedStrategies userId={userId} />
    if (pathname === '/notebook') return <GatedNotebook userId={userId} />
    if (pathname === '/import') return <GatedImport userId={userId} existingTrades={trades} onImported={reloadTrades} />
    if (pathname === '/settings') return <Settings userEmail={userEmail} />
    if (pathname === '/ai-analysis') return <GatedAIAnalysis trades={trades} />
    if (pathname === '/billing') return <Billing />

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px' }}>
        <div style={{ fontSize: '32px' }}>🚧</div>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>Coming soon</div>
        <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>This section is being built in the next phase.</div>
      </div>
    )
  }

  return (
    <PlanProvider>
      <AppShell title={title} userEmail={userEmail} filter={filter} onFilterChange={setFilter} onAddTrade={openAdd}>
        {renderPage()}
      </AppShell>
      <AddTradeModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTrade(null) }}
        onSave={handleSave}
        editTrade={editTrade}
        strategies={strategies}
      />
    </PlanProvider>
  )
}
