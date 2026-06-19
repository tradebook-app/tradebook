'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Plan = 'free' | 'pro' | 'elite'

type PlanContext = {
  plan: Plan
  tradeCount: number
  loading: boolean
  isPro: boolean
  isElite: boolean
  canAddTrade: boolean
  canAccessFeature: (feature: 'reports_full' | 'importer' | 'notebook' | 'strategies') => boolean
  reloadPlan: () => void
}

const Ctx = createContext<PlanContext>({
  plan: 'free', tradeCount: 0, loading: true,
  isPro: false, isElite: false, canAddTrade: true,
  canAccessFeature: () => false,
  reloadPlan: () => {},
})

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan>('free')
  const [tradeCount, setTradeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/subscription')
      const d = await res.json()
      setPlan(d.plan || 'free')
      setTradeCount(d.tradeCount || 0)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const isPro = plan === 'pro' || plan === 'elite'
  const isElite = plan === 'elite'
  const FREE_LIMIT = 50
  const canAddTrade = isPro || tradeCount < FREE_LIMIT

  function canAccessFeature(feature: 'reports_full' | 'importer' | 'notebook' | 'strategies') {
    if (isPro) return true
    // Free users can only access basic dashboard and 1 report tab
    return false
  }

  return (
    <Ctx.Provider value={{ plan, tradeCount, loading, isPro, isElite, canAddTrade, canAccessFeature, reloadPlan: load }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePlan() {
  return useContext(Ctx)
}
