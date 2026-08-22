import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

// Per-partner ledger detail. Uses adminClient() (service-role) for the data
// reads -- see the comment on GET in ../route.ts: referral_commissions' only
// RLS policy scopes SELECT to auth.uid() = referrer_id with no admin bypass,
// so a plain session client would 404/empty-ledger for every partner other
// than the signed-in admin themselves. The auth check still uses the plain
// session client, since it only needs the caller's own identity.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const admin = adminClient()

  const { data: partner } = await admin
    .from('profiles')
    .select('id, first_name, referral_code, commission_rate, commission_months')
    .eq('id', params.id)
    .eq('is_partner', true)
    .maybeSingle()

  if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

  const { data: ledger } = await admin
    .from('referral_commissions')
    .select('*')
    .eq('referrer_id', params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ partner, ledger: ledger || [] })
}
