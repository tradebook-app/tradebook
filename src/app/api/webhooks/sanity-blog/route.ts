import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('sanity-webhook-secret')
    if (secret !== process.env.SANITY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const title = body.title as string
    const slug = body.slug?.current as string
    const excerpt = (body.excerpt as string) || 'Read the latest from Sleektrade.'

    if (!title || !slug) {
      return NextResponse.json({ error: 'Missing post data' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: subscribers, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('newsletter_opt_in', true)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const postUrl = `https://sleektrade.app/blog/${slug}`

    await Promise.all(
      subscribers.map((sub) =>
        resend.emails.send({
          from: 'noreply@sleektrade.app',
          to: sub.email,
          subject: `New post: ${title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #10B981;">${title}</h2>
              <p style="color: #444; line-height: 1.6;">${excerpt}</p>
              <a href="${postUrl}" style="display: inline-block; background: #10B981; color: #000; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700;">Read the post</a>
            </div>
          `,
        })
      )
    )

    return NextResponse.json({ ok: true, sent: subscribers.length })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}