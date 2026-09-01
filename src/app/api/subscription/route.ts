import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ plan: 'free', tradeCount: 0 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, subscription_status, plan_override')
      .eq('id', user.id)
      .single()

    const { count } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      plan: profile?.plan || 'free',
      status: profile?.subscription_status || null,
      tradeCount: count || 0,
      // Observability only -- not used for gating anywhere. Lets the UI/logs
      // distinguish a manual founder/comp grant from a real subscription.
      override: profile?.plan_override === true,
    })
  } catch (err) {
    // Do NOT silently return a free plan here — a transient DB/auth error would
    // downgrade a paying user with no trace. Log it and signal failure so the
    // client can keep the last-known plan and retry.
    console.error('subscription route error:', err)
    return NextResponse.json({ error: 'Failed to load subscription' }, { status: 500 })
  }
}
