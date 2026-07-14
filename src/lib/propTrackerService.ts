import { createClient } from '@/lib/supabase/client'
import type {
  PropFirmAccountRow, PropFirmAccountInsert, PropFirmAccountUpdate,
  PropFirmTransactionRow, PropFirmTransactionInsert, PropFirmTransactionUpdate,
} from '@/lib/types'

// ─── Accounts ───────────────────────────────────────────────────────────────

export async function fetchPropFirmAccounts(): Promise<PropFirmAccountRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prop_firm_accounts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function insertPropFirmAccount(account: PropFirmAccountInsert, userId: string): Promise<PropFirmAccountRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prop_firm_accounts')
    .insert({ ...account, user_id: userId })
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updatePropFirmAccount(id: string, updates: PropFirmAccountUpdate): Promise<PropFirmAccountRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prop_firm_accounts')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function deletePropFirmAccount(id: string): Promise<boolean> {
  const supabase = createClient()
  // Transactions cascade-delete via FK (see SQL), so no need to clear them here.
  const { error } = await supabase.from('prop_firm_accounts').delete().eq('id', id)
  return !error
}

// ─── Transactions ───────────────────────────────────────────────────────────

export async function fetchPropFirmTransactions(): Promise<PropFirmTransactionRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prop_firm_transactions')
    .select('*')
    .order('date', { ascending: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function insertPropFirmTransaction(txn: PropFirmTransactionInsert, userId: string): Promise<PropFirmTransactionRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prop_firm_transactions')
    .insert({ ...txn, user_id: userId })
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updatePropFirmTransaction(id: string, updates: PropFirmTransactionUpdate): Promise<PropFirmTransactionRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prop_firm_transactions')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function deletePropFirmTransaction(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('prop_firm_transactions').delete().eq('id', id)
  return !error
}
