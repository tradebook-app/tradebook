import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUnsubToken } from '@/lib/newsletterToken'

// Instant unsubscribe: user clicks the link in an email, we verify the signed
// token, set newsletter_opt_in = false, and show a plain confirmation page.
// GET (not POST) because it's a link click — safe since it only ever unsubscribes.

function page(title: string, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin:0; background:#0D0D11; color:#F1F1F3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
      .card { max-width:420px; text-align:center; padding:0 24px; }
      h1 { color:#10B981; font-size:20px; margin-bottom:12px; }
      p { color:#9999AA; font-size:14px; line-height:1.6; }
      a { display:inline-block; margin-top:24px; color:#34D399; text-decoration:none; font-size:13px; font-weight:600; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="https://sleektrade.app">← Back to Sleektrade</a>
    </div>
  </body>
</html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.nextUrl.searchParams.get('uid')
    const token = req.nextUrl.searchParams.get('token')

    if (!uid || !token || !verifyUnsubToken(uid, token)) {
      return page('Invalid link', 'This unsubscribe link is invalid or has expired. Please use the link from a recent email.')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('profiles')
      .update({ newsletter_opt_in: false })
      .eq('id', uid)

    if (error) {
      console.error('[unsubscribe] update failed:', error.message)
      return page('Something went wrong', 'We could not process your request right now. Please try again in a moment.')
    }

    return page("You're unsubscribed", "You won't receive any more blog or trading-tips emails from Sleektrade. You can re-enable them anytime from your account settings.")
  } catch (err) {
    console.error('[unsubscribe] unexpected error:', err)
    return page('Something went wrong', 'We could not process your request right now. Please try again in a moment.')
  }
}
