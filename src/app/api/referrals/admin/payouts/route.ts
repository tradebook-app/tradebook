import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Comma-separated list of admin emails allowed to view/manage payouts.
// Set ADMIN_EMAILS in Vercel env vars, e.g. "you@sleektrade.app"
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data: commissions } = await supabase
    .from('referral_commissions')
    .select('*')
    .eq('status', 'pending')
    .order('referrer_id')

  const now = Date.now()
  const availableRows = (commissions || []).filter(r => new Date(r.available_at).getTime() <= now)

  const referrerIds = [...new Set(availableRows.map(r => r.referrer_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, referral_code')
    .in('id', referrerIds.length > 0 ? referrerIds : ['00000000-0000-0000-0000-000000000000'])

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  const byReferrer: Record<string, { referrerId: string; name: string; code: string | null; total: number; commissionIds: string[] }> = {}
  for (const row of availableRows) {
    if (!byReferrer[row.referrer_id]) {
      const p = profileMap.get(row.referrer_id)
      byReferrer[row.referrer_id] = { referrerId: row.referrer_id, name: p?.first_name || 'Unknown', code: p?.referral_code || null, total: 0, commissionIds: [] }
    }
    byReferrer[row.referrer_id].total += Number(row.commission_amount)
    byReferrer[row.referrer_id].commissionIds.push(row.id)
  }

  return NextResponse.json({ payouts: Object.values(byReferrer) })
}
