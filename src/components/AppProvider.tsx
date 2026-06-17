'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { DasImport } from '@/components/import/DasImport'
import { Reports } from '@/components/reports/Reports'

type Props = {
  userId: string
  userEmail?: string
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':     'Dashboard',
  '/trades':        'Trade View',
  '/notebook':      'Notebook',
  '/reports':       'Reports',
  '/strategies':    'Strategies',
  '/position-size': 'Position Size',
  '/import':        'Import DAS',
}

export function AppProvider({ userId, userEmail }: Props) {
  const pathname = usePathname()

  const [trades,      setTrades]      = useState<TradeRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editTrade,   setEditTrade]   = useState<TradeRow | null>(null)
  const [filter,      setFilter]      = useState<DateRangeFilter>({ range: 'all' })

  // Load trades on mount
  useEffect(() => {
    fetchTrades().then(data => {
      setTrades(data)
      setLoading(false)
    })
  }, [])

  // Keyboard shortcut: 'n' opens Add Trade
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

  function openAdd() {
    setEditTrade(null)
    setModalOpen(true)
  }

  function openEdit(trade: TradeRow) {
    setEditTrade(trade)
    setModalOpen(true)
  }

  async function handleSave(payload: TradeFormPayload, screenshotFile: File | null) {
    // Upload screenshot if provided
    let screenshotUrl: string | null = editTrade?.screenshot_url || null
    if (screenshotFile) {
      screenshotUrl = await uploadScreenshot(screenshotFile, userId)
    }

    const tradeData = {
      ...payload,
      screenshot_url: screenshotUrl,
    }

    if (editTrade) {
      // Update existing
      const updated = await updateTrade(editTrade.id, tradeData)
      if (updated) {
        setTrades(prev => prev.map(t => t.id === editTrade.id ? updated : t))
      }
    } else {
      // Insert new
      const inserted = await insertTrade(tradeData, userId)
      if (inserted) {
        setTrades(prev => [inserted, ...prev])
      }
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

  // Re-fetch all trades from the database (used after a bulk import)
  async function reloadTrades() {
    const data = await fetchTrades()
    setTrades(data)
  }

  // All unique strategy names from trades
  const strategies = Array.from(new Set(trades.map(t => t.setup).filter((x) => Boolean(x)))).sort()

  const title = PAGE_TITLES[pathname] || 'TRADEBOOK'

  // Render correct page content
  function renderPage() {
    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--txt3)' }}>
          Loading...
        </div>
      )
    }

    if (pathname === '/trades') {
      return (
        <TradeView
          trades={trades}
          filter={filter}
          onEdit={openEdit}
          onDelete={handleDelete}
          onDeleteFiltered={handleDeleteMany}
        />
      )
    }

    if (pathname === '/dashboard') {
      return (
        <Dashboard
          trades={trades}
          filter={filter}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )
    }

    if (pathname === '/reports') {
      return <Reports trades={trades} filter={filter} />
    }

    if (pathname === '/import') {
      return (
        <DasImport
          userId={userId}
          existingTrades={trades}
          onImported={reloadTrades}
        />
      )
    }

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
      <AppShell
        title={title}
        userEmail={userEmail}
        filter={filter}
        onFilterChange={setFilter}
        onAddTrade={openAdd}
      >
        {renderPage()}
      </AppShell>

      <AddTradeModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTrade(null) }}
        onSave={handleSave}
        editTrade={editTrade}
        strategies={strategies}
      />
    </>
  )
}
