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
    .select('id, first_name, referral_code, commission_rate, commission_months, commission_window_start, commission_window_end')
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

// Edits a partner's rate/window, or reverts them to normal/friend status.
// Two mutually exclusive request shapes -- see docs/superpowers/specs/
// 2026-08-22-partner-edit-cancel-design.md. Uses adminClient() like GET
// above, for the same reason: these columns aren't client-writable
// (migration 004) and referral_commissions/profiles RLS would otherwise
// block or misscope this admin-only write.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const admin = adminClient()

  // Remove-partner shape: reset every partner-specific column back to the
  // standard friend defaults. referral_code is left alone -- it preserves
  // historical attribution links and past ledger readability.
  if (body.is_partner === false) {
    const { error } = await admin
      .from('profiles')
      .update({
        is_partner: false,
        commission_rate: 0.20,
        commission_months: 6,
        commission_window_start: null,
        commission_window_end: null,
      })
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Edit-terms shape: full replace of rate + window (not a partial patch --
  // a half-updated window is meaningless).
  const { commission_rate, commission_window_start, commission_window_end } = body
  if (
    typeof commission_rate !== 'number' || !(commission_rate > 0 && commission_rate <= 1) ||
    typeof commission_window_start !== 'string' || typeof commission_window_end !== 'string'
  ) {
    return NextResponse.json(
      { error: 'commission_rate (0-1), commission_window_start, and commission_window_end are all required' },
      { status: 400 }
    )
  }

  const start = new Date(commission_window_start)
  const end = new Date(commission_window_end)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }
  if (end.getTime() <= start.getTime()) {
    return NextResponse.json({ error: 'commission_window_end must be after commission_window_start' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', params.id)
    .eq('is_partner', true)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      commission_rate,
      commission_window_start: start.toISOString(),
      commission_window_end: end.toISOString(),
    })
    .eq('id', params.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
