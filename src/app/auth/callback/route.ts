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
      // If user has a recovery_sent_at, this is a password reset flow
      if (user?.recovery_sent_at) {
        return NextResponse.redirect(`${origin}/update-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error → redirect to login with error hint
  return NextResponse.redirect(`${origin}/login?error=auth`)
}