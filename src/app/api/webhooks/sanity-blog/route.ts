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

    // profiles has no email column — get the opted-in user IDs here,
    // then resolve their emails from auth.users via the admin API below.
    const { data: optedIn, error: profErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('newsletter_opt_in', true)

    if (profErr) {
      console.error('[sanity-blog] profiles query failed:', profErr.message)
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    if (!optedIn || optedIn.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const optedInIds = new Set(optedIn.map((p) => p.id))

    // Resolve emails from auth.users. listUsers is paginated (default 50/page),
    // so walk pages until we've collected everyone or run out.
    const emails: string[] = []
    let page = 1
    const perPage = 1000
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: usersPage, error: usersErr } =
        await supabase.auth.admin.listUsers({ page, perPage })

      if (usersErr) {
        console.error('[sanity-blog] listUsers failed:', usersErr.message)
        return NextResponse.json({ error: usersErr.message }, { status: 500 })
      }

      for (const u of usersPage.users) {
        if (optedInIds.has(u.id) && u.email) {
          emails.push(u.email)
        }
      }

      if (usersPage.users.length < perPage) break
      page += 1
    }

    if (emails.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const postUrl = `https://sleektrade.app/blog/${slug}`

    const results = await Promise.allSettled(
      emails.map((email) =>
        resend.emails.send({
          from: 'noreply@sleektrade.app',
          to: email,
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

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      console.error(`[sanity-blog] ${failed.length}/${emails.length} sends failed`, failed[0])
    }

    return NextResponse.json({
      ok: true,
      sent: emails.length - failed.length,
      failed: failed.length,
    })
  } catch (err) {
    console.error('[sanity-blog] unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
