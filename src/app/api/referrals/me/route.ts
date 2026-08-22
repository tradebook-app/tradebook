import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient, ensureReferralCode } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, referral_code, commission_months, commission_rate, is_partner, commission_window_end')
    .eq('id', user.id)
    .maybeSingle()

  const seed = profile?.first_name || user.email?.split('@')[0] || 'user'
  const code = profile?.referral_code || await ensureReferralCode(user.id, seed)

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

  // Service-role: counting rows where referred_by = the caller means reading
  // OTHER users' profiles, which the caller's own session (RLS: own row
  // only) can never see -- this would otherwise always report zero.
  const { count: referredCount } = await adminClient()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', user.id)

  return NextResponse.json({
    code,
    link,
    commissionMonths: profile?.commission_months ?? 6,
    commissionRate: profile?.commission_rate ?? 0.20,
    isPartner: profile?.is_partner ?? false,
    commissionWindowEnd: profile?.commission_window_end ?? null,
    stats: {
      referredCount: referredCount || 0,
      pendingAmount,
      availableAmount,
      paidAmount,
    },
    commissions: rows,
  })
}
