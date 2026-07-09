import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureReferralCode } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, referral_code')
    .eq('id', user.id)
    .maybeSingle()

  const seed = profile?.first_name || user.email?.split('@')[0] || 'user'
  const code = profile?.referral_code || await ensureReferralCode(supabase, user.id, seed)

  const origin = new URL(request.url).origin
  const link = `${origin}/signup?ref=${code}`

  const { data: commissions } = await supabase
    .from('referral_commissions')
    .select('*')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })

  const rows = commissions || []
  const now = Date.now()

  const pendingAmount = rows
    .filter(r => r.status === 'pending' && new Date(r.available_at).getTime() > now)
    .reduce((s, r) => s + Number(r.commission_amount), 0)

  const availableAmount = rows
    .filter(r => r.status === 'pending' && new Date(r.available_at).getTime() <= now)
    .reduce((s, r) => s + Number(r.commission_amount), 0)

  const paidAmount = rows
    .filter(r => r.status === 'paid')
    .reduce((s, r) => s + Number(r.commission_amount), 0)

  const { count: referredCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', user.id)

  return NextResponse.json({
    code,
    link,
    stats: {
      referredCount: referredCount || 0,
      pendingAmount,
      availableAmount,
      paidAmount,
    },
    commissions: rows,
  })
}
