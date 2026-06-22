import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { name, email, subject, message } = await req.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await resend.emails.send({
      from: 'Sleektrade Contact <noreply@sleektrade.app>',
      to: 'vermonski@gmail.com',
      replyTo: email,
      subject: `Contact: ${subject || 'New message from ' + name}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#131318;border-radius:12px;border:1px solid #252530;">
          <h2 style="color:#F1F1F3;font-size:20px;margin:0 0 24px;">New contact message</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:10px 0;border-bottom:1px solid #252530;color:#9999AA;font-size:13px;width:100px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #252530;color:#F1F1F3;font-size:13px;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #252530;color:#9999AA;font-size:13px;">Email</td><td style="padding:10px 0;border-bottom:1px solid #252530;color:#10B981;font-size:13px;">${email}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #252530;color:#9999AA;font-size:13px;">Subject</td><td style="padding:10px 0;border-bottom:1px solid #252530;color:#F1F1F3;font-size:13px;">${subject || '—'}</td></tr>
          </table>
          <div style="margin-top:24px;">
            <div style="color:#9999AA;font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">Message</div>
            <div style="color:#F1F1F3;font-size:14px;line-height:1.7;background:#1A1A24;border-radius:8px;padding:16px;border:1px solid #252530;">${message.replace(/\n/g, '<br/>')}</div>
          </div>
          <p style="margin-top:24px;font-size:12px;color:#606070;">Reply directly to this email to respond to ${name}.</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact email error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
