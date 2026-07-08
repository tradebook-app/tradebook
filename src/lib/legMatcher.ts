import { createClient } from '@/lib/supabase/client'

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

// Fetch all stored open legs for this user, grouped by symbol, for a set of symbols
// appearing in the file currently being imported.
export async function fetchOpenLegs(userId: string, symbols: string[]): Promise<Record<string, OpenLeg[]>> {
  if (symbols.length === 0) return {}
  const supabase = createClient()
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

// Replace all stored open legs for a symbol with a new leftover leg (or none, if fully closed).
export async function replaceOpenLeg(
  userId: string,
  symbol: string,
  consumedIds: string[],
  leftover: Omit<OpenLeg, 'id' | 'broker'> | null,
  broker: string
): Promise<void> {
  const supabase = createClient()

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
