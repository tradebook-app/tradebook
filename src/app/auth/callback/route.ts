import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { attributeReferral } from '@/lib/referrals'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const refCode = searchParams.get('ref')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      // Attribute referral server-side. This is what makes Google OAuth signups
      // work — localStorage from the signup page isn't reachable here, so the
      // ref code has to travel through as a URL param on the OAuth redirect
      // instead. Awaited (not fire-and-forget) so it completes before this
      // serverless function returns. Safe to run even for email/password users
      // who already got attributed client-side — attributeReferral no-ops if
      // the user is already attributed.
      if (refCode && user) {
        await attributeReferral(user.id, refCode).catch(() => {})
      }

      // Only redirect to update-password if recovery was sent recently (within 10 min)
      // This prevents Google OAuth users from being sent to update-password
      if (user?.recovery_sent_at) {
        const recoverySentAt = new Date(user.recovery_sent_at).getTime()
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000
        if (recoverySentAt > tenMinutesAgo) {
          return NextResponse.redirect(`${origin}/update-password`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
