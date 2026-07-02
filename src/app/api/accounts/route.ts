import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Plan → max trading accounts. Free: 1, Pro: 3, Elite: unlimited.
// This must match the limits shown in PricingSection.tsx and Settings.tsx.
const ACCOUNT_LIMITS: Record<string, number> = {
  free: 1,
  pro: 3,
  elite: Infinity,
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('trading_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: data })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { name, broker } = await request.json()
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Account name is required.' }, { status: 400 })
  }

  // Enforce plan limit server-side — never trust the client for this.
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const plan = profile?.plan || 'free'
  const limit = ACCOUNT_LIMITS[plan] ?? 1

  const { count } = await supabase
    .from('trading_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count || 0) >= limit) {
    return NextResponse.json({
      error: `Your ${plan} plan allows up to ${limit === Infinity ? 'unlimited' : limit} trading account${limit === 1 ? '' : 's'}. Upgrade to add more.`,
      limitReached: true,
      plan,
      limit: limit === Infinity ? null : limit,
    }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('trading_accounts')
    .insert({ user_id: user.id, name: name.trim(), broker: broker?.trim() || null, is_default: (count || 0) === 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data })
}
