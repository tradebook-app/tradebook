import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Uses the service-role client because this runs immediately after signUp(),
// before the user has a confirmed session (same pattern as /api/cron/enrich).
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const { userId, code } = await request.json()
  if (!userId || !code) return NextResponse.json({ error: 'userId and code are required' }, { status: 400 })

  const supabase = adminClient()

  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle()

  if (!referrer) return NextResponse.json({ ok: false, reason: 'Unknown referral code' })
  if (referrer.id === userId) return NextResponse.json({ ok: false, reason: 'Cannot refer yourself' })

  // Only set referred_by if not already set (don't overwrite an earlier attribution)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('referred_by')
    .eq('id', userId)
    .maybeSingle()

  if (existingProfile?.referred_by) {
    return NextResponse.json({ ok: false, reason: 'User already attributed' })
  }

  await supabase.from('profiles').upsert({ id: userId, referred_by: referrer.id })
  return NextResponse.json({ ok: true })
}
