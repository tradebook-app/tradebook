import { NextResponse } from 'next/server'
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
  // listUsers() is unpaginated here by default (first page only), which is
  // fine at the partner-program's expected scale (a handful of partners);
  // revisit if the user base grows large enough that a partner's account
  // might be past the first page.
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })

  const target = usersPage.users.find(u => (u.email || '').toLowerCase() === body.email.trim().toLowerCase())
  if (!target) return NextResponse.json({ error: 'No account with that email' }, { status: 404 })

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ is_partner: true, referral_code: normalizedCode, commission_months: 12 })
    .eq('id', target.id)

  if (updateErr) {
    if (updateErr.code === '23505') {
      return NextResponse.json({ error: 'That code is already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: target.id, code: normalizedCode })
}
