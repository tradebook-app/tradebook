import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
const VANITY_CODE_RE = /^[a-z0-9-]{3,20}$/

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.email !== 'string' || typeof body.code !== 'string') {
    return NextResponse.json({ error: 'email and code are required' }, { status: 400 })
  }

  const normalizedCode = body.code.trim().toLowerCase()
  if (!VANITY_CODE_RE.test(normalizedCode)) {
    return NextResponse.json({ error: 'Code must be 3-20 lowercase letters, numbers, or hyphens' }, { status: 400 })
  }

  const admin = adminClient()

  // profiles has no email column -- resolve the target user via auth admin.
  // listUsers() defaults to the first 50 users only, so page through until
  // the target is found or the user list is exhausted -- otherwise a
  // partner's account past page 1 looks like a typo (a false 404).
  const normalizedEmail = body.email.trim().toLowerCase()
  let target: User | undefined
  for (let page = 1; !target; page++) {
    const res = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (res.error) return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })
    // TS can't narrow the listUsers() discriminated union here because this
    // project runs with strict/strictNullChecks off (tsconfig.json), which
    // defeats the null-vs-non-null discriminant on `error` -- confirmed by
    // reproducing with `tsc --strict false` vs `--strict`. The explicit
    // (u: User) annotation and the `'nextPage' in res.data` guard below are
    // working around that instead of fighting the type system further.
    target = res.data.users.find((u: User) => (u.email || '').toLowerCase() === normalizedEmail)
    if (!('nextPage' in res.data) || res.data.nextPage === null) break // last page
  }
  if (!target) return NextResponse.json({ error: 'No account with that email' }, { status: 404 })

  const windowStart = new Date()
  const windowEnd = new Date(windowStart)
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + 12) // same UTC-month arithmetic as isWithinCommissionWindow

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      is_partner: true,
      referral_code: normalizedCode,
      commission_window_start: windowStart.toISOString(),
      commission_window_end: windowEnd.toISOString(),
    })
    .eq('id', target.id)

  if (updateErr) {
    if (updateErr.code === '23505') {
      return NextResponse.json({ error: 'That code is already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: target.id, code: normalizedCode })
}

// Partner rollup list. Uses adminClient() (service-role) for the data reads,
// matching the pattern in ./payouts and ./mark-paid: profiles' "Service role
// full access" policy is unconditional (see migration 002) so a plain session
// client happens to work there, but referral_commissions has only one policy
// ("Users can view their own referral commissions", USING auth.uid() =
// referrer_id) with no admin bypass -- a plain session client would silently
// return zero rows for every partner other than the signed-in admin
// themselves, exactly the payouts/mark-paid pitfall documented in migration
// 002. The auth check itself still uses the plain session client, since it
// only needs the caller's own identity.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const admin = adminClient()

  const { data: partners } = await admin
    .from('profiles')
    .select('id, first_name, referral_code, commission_rate, commission_months, commission_window_start, commission_window_end')
    .eq('is_partner', true)

  const partnerIds = (partners || []).map(p => p.id)
  const emptyIdList = ['00000000-0000-0000-0000-000000000000']

  const { data: commissions } = await admin
    .from('referral_commissions')
    .select('referrer_id, gross_amount, commission_amount, status, available_at')
    .in('referrer_id', partnerIds.length ? partnerIds : emptyIdList)

  const { data: referredCounts } = await admin
    .from('profiles')
    .select('referred_by')
    .in('referred_by', partnerIds.length ? partnerIds : emptyIdList)

  const now = Date.now()
  const rows = commissions || []

  const result = (partners || []).map(p => {
    const own = rows.filter(r => r.referrer_id === p.id)
    const grossTotal = own.reduce((s, r) => s + Number(r.gross_amount), 0)
    const commissionTotal = own.reduce((s, r) => s + Number(r.commission_amount), 0)
    const owed = own
      .filter(r => r.status === 'pending' && new Date(r.available_at).getTime() <= now)
      .reduce((s, r) => s + Number(r.commission_amount), 0)
    const paid = own
      .filter(r => r.status === 'paid')
      .reduce((s, r) => s + Number(r.commission_amount), 0)
    const signups = (referredCounts || []).filter(r => r.referred_by === p.id).length

    return {
      id: p.id,
      name: p.first_name || 'Unknown',
      code: p.referral_code,
      rate: p.commission_rate,
      months: p.commission_months,
      windowStart: p.commission_window_start,
      windowEnd: p.commission_window_end,
      signups,
      grossTotal,
      commissionTotal,
      owed,
      paid,
    }
  })

  return NextResponse.json({ partners: result })
}
