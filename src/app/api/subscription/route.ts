import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ plan: 'free', tradeCount: 0 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, subscription_status')
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
    })
  } catch (err) {
    return NextResponse.json({ plan: 'free', tradeCount: 0 })
  }
}
