'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePlan } from '@/components/PlanProvider'

export type TradingAccount = {
  id: string
  name: string
  broker: string | null
  is_default: boolean
  created_at: string
}

type AccountContext = {
  accounts: TradingAccount[]
  loading: boolean
  limit: number | null // null = unlimited
  atLimit: boolean
  addAccount: (name: string, broker?: string) => Promise<{ ok: boolean; error?: string }>
  renameAccount: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>
  deleteAccount: (id: string) => Promise<{ ok: boolean; error?: string }>
  reload: () => void
}

const Ctx = createContext<AccountContext>({
  accounts: [], loading: true, limit: 1, atLimit: false,
  addAccount: async () => ({ ok: false }),
  renameAccount: async () => ({ ok: false }),
  deleteAccount: async () => ({ ok: false }),
  reload: () => {},
})

// Must match ACCOUNT_LIMITS in /api/accounts/route.ts — kept here too so the
// UI can show "2/3 accounts used" without waiting on a failed POST.
const ACCOUNT_LIMITS: Record<string, number | null> = {
  free: 1,
  pro: 3,
  elite: null,
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { plan } = usePlan()
  const [accounts, setAccounts] = useState<TradingAccount[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/accounts')
      const d = await res.json()
      setAccounts(d.accounts || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // NOTE: don't use `?? 1` here — ACCOUNT_LIMITS.elite is intentionally
  // `null` (meaning unlimited), and `??` treats null as missing too, so it
  // was silently turning "unlimited" into "1" for Elite users.
  const limit = plan in ACCOUNT_LIMITS ? ACCOUNT_LIMITS[plan] : 1
  const atLimit = limit !== null && accounts.length >= limit

  async function addAccount(name: string, broker?: string) {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, broker }),
    })
    const d = await res.json()
    if (!res.ok) return { ok: false, error: d.error || 'Failed to add account.' }
    setAccounts(prev => [...prev, d.account])
    return { ok: true }
  }

  async function renameAccount(id: string, name: string) {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const d = await res.json()
    if (!res.ok) return { ok: false, error: d.error || 'Failed to rename account.' }
    setAccounts(prev => prev.map(a => a.id === id ? d.account : a))
    return { ok: true }
  }

  async function deleteAccount(id: string) {
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    const d = await res.json()
    if (!res.ok) return { ok: false, error: d.error || 'Failed to delete account.' }
    setAccounts(prev => prev.filter(a => a.id !== id))
    return { ok: true }
  }

  return (
    <Ctx.Provider value={{ accounts, loading, limit, atLimit, addAccount, renameAccount, deleteAccount, reload: load }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAccounts() {
  return useContext(Ctx)
}
