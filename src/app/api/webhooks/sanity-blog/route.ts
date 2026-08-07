import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildUnsubUrl } from '@/lib/newsletterToken'

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

    // profiles has no email column — get opted-in user IDs here, then resolve
    // emails from auth.users via the admin API below.
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

    // Resolve emails from auth.users. listUsers is paginated, so walk pages.
    // Keep the id alongside the email so each email gets its own unsub link.
    const recipients: { id: string; email: string }[] = []
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
          recipients.push({ id: u.id, email: u.email })
        }
      }

      if (usersPage.users.length < perPage) break
      page += 1
    }

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const postUrl = `https://sleektrade.app/blog/${slug}`

    const results = await Promise.allSettled(
      recipients.map((r) => {
        const unsubUrl = buildUnsubUrl(r.id)
        return resend.emails.send({
          from: 'noreply@sleektrade.app',
          to: r.email,
          subject: `New post: ${title}`,
          // List-Unsubscribe header lets Gmail/Outlook show a native
          // "Unsubscribe" button at the top of the email too.
          headers: {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #10B981;">${title}</h2>
              <p style="color: #444; line-height: 1.6;">${excerpt}</p>
              <a href="${postUrl}" style="display: inline-block; background: #10B981; color: #000; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700;">Read the post</a>
              <hr style="border:none; border-top:1px solid #eee; margin:28px 0 14px;" />
              <p style="color:#999; font-size:11px; line-height:1.5;">
                You're receiving this because you opted in to Sleektrade updates.
                <a href="${unsubUrl}" style="color:#999; text-decoration:underline;">Unsubscribe</a>
              </p>
            </div>
          `,
        })
      })
    )

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      console.error(`[sanity-blog] ${failed.length}/${recipients.length} sends failed`, failed[0])
    }

    return NextResponse.json({
      ok: true,
      sent: recipients.length - failed.length,
      failed: failed.length,
    })
  } catch (err) {
    console.error('[sanity-blog] unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
