import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

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
