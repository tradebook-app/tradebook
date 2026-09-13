import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

// Same env var and pattern as src/app/api/referrals/admin/*.ts.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

const RECENT_SIGNUPS_LIMIT = 50
const DAY_MS = 24 * 60 * 60 * 1000

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const admin = adminClient()
  const { data, error } = await admin.rpc('admin_user_stats')
  if (error) {
    console.error('admin_user_stats error:', error)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }

  const users = data || []
  const now = Date.now()

  const planCounts = { free: 0, pro: 0, elite: 0 }
  for (const u of users) {
    if (u.plan === 'pro') planCounts.pro++
    else if (u.plan === 'elite') planCounts.elite++
    else planCounts.free++
  }

  // admin_user_stats() already orders newest-first.
  const recentSignups = users.slice(0, RECENT_SIGNUPS_LIMIT).map(u => ({
    email: u.email,
    plan: u.plan,
    created_at: u.created_at,
  }))

  const signups7d = users.filter(u => now - new Date(u.created_at).getTime() <= 7 * DAY_MS).length
  const signups30d = users.filter(u => now - new Date(u.created_at).getTime() <= 30 * DAY_MS).length

  return NextResponse.json({
    totalUsers: users.length,
    planCounts,
    recentSignups,
    signups7d,
    signups30d,
  })
}
