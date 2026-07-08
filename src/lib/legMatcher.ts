import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbClient = SupabaseClient<any, any, any>

export type OpenLeg = {
  id: string
  symbol: string
  side: 'Long' | 'Short'
  qty: number
  price: number
  opened_at: string
  commission: number
  broker: string
}

// ── Client-agnostic core (works with either the browser client or a server/service-role client) ──

export async function fetchOpenLegsWithClient(
  supabase: DbClient,
  userId: string,
  symbols: string[]
): Promise<Record<string, OpenLeg[]>> {
  if (symbols.length === 0) return {}
  const { data, error } = await supabase
    .from('open_legs')
    .select('*')
    .eq('user_id', userId)
    .in('symbol', symbols)
    .order('opened_at', { ascending: true })

  if (error) { console.error('Fetch open legs error:', error); return {} }

  const bySymbol: Record<string, OpenLeg[]> = {}
  for (const leg of data || []) {
    if (!bySymbol[leg.symbol]) bySymbol[leg.symbol] = []
    bySymbol[leg.symbol].push(leg as OpenLeg)
  }
  return bySymbol
}

export async function replaceOpenLegWithClient(
  supabase: DbClient,
  userId: string,
  symbol: string,
  consumedIds: string[],
  leftover: Omit<OpenLeg, 'id' | 'broker'> | null,
  broker: string
): Promise<void> {
  if (consumedIds.length > 0) {
    await supabase.from('open_legs').delete().in('id', consumedIds)
  }

  if (leftover && leftover.qty > 0) {
    await supabase.from('open_legs').insert({
      user_id:    userId,
      symbol,
      side:       leftover.side,
      qty:        leftover.qty,
      price:      leftover.price,
      opened_at:  leftover.opened_at,
      commission: leftover.commission,
      broker,
    })
  }
}

// ── Browser-only convenience wrappers (used by the existing client-side CSV importers) ──

export async function fetchOpenLegs(userId: string, symbols: string[]): Promise<Record<string, OpenLeg[]>> {
  return fetchOpenLegsWithClient(createClient(), userId, symbols)
}

export async function replaceOpenLeg(
  userId: string,
  symbol: string,
  consumedIds: string[],
  leftover: Omit<OpenLeg, 'id' | 'broker'> | null,
  broker: string
): Promise<void> {
  return replaceOpenLegWithClient(createClient(), userId, symbol, consumedIds, leftover, broker)
}
