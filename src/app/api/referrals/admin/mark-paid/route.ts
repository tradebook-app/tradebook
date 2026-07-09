import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { commissionIds } = await request.json()
  if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
    return NextResponse.json({ error: 'commissionIds array is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('referral_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .in('id', commissionIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, marked: commissionIds.length })
}
