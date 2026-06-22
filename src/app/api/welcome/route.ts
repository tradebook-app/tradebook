import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    await resend.emails.send({
      from: 'Ahmad Yassine at Sleektrade <noreply@sleektrade.app>',
      to: email,
      subject: 'Welcome to Sleektrade 🎯',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to Sleektrade</title>
</head>
<body style="margin:0;padding:0;background:#0D0D11;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D11;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <img src="https://sleektrade.app/favicon.svg" width="36" height="36" alt="Sleektrade" style="display:block;border-radius:8px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:800;color:#F1F1F3;letter-spacing:-0.01em;">
                      Sleek<span style="color:#1D9E75;">trade</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#131318;border:1px solid #252530;border-radius:14px;padding:40px 40px 32px;">

              <!-- Greeting -->
              <p style="font-size:22px;font-weight:700;color:#F1F1F3;margin:0 0 16px;">
                Welcome aboard 👋
              </p>
              <p style="font-size:14px;color:#9999AA;line-height:1.7;margin:0 0 28px;">
                I'm Ahmad — I built Sleektrade because I was frustrated with spreadsheets and generic tools that weren't built for real traders. Sleektrade is the journal I wished I had when I started.
              </p>

              <!-- Divider -->
              <div style="height:1px;background:#252530;margin:0 0 28px;"></div>

              <!-- What to do next -->
              <p style="font-size:12px;font-weight:700;color:#F1F1F3;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 18px;">
                Here's what to do first
              </p>

              <!-- Step 1 -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;width:100%;">
                <tr>
                  <td style="width:32px;vertical-align:top;padding-top:2px;">
                    <div style="width:24px;height:24px;background:rgba(16,185,129,0.12);border-radius:6px;text-align:center;line-height:24px;font-size:11px;font-weight:700;color:#10B981;">1</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="font-size:13px;font-weight:600;color:#F1F1F3;margin:0 0 3px;">Confirm your email</p>
                    <p style="font-size:12px;color:#9999AA;margin:0;line-height:1.6;">Check your inbox for the confirmation link — click it to activate your account.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 2 -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;width:100%;">
                <tr>
                  <td style="width:32px;vertical-align:top;padding-top:2px;">
                    <div style="width:24px;height:24px;background:rgba(16,185,129,0.12);border-radius:6px;text-align:center;line-height:24px;font-size:11px;font-weight:700;color:#10B981;">2</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="font-size:13px;font-weight:600;color:#F1F1F3;margin:0 0 3px;">Import your first trades</p>
                    <p style="font-size:12px;color:#9999AA;margin:0;line-height:1.6;">Connect DAS Trader, ThinkOrSwim, IBKR, or log a trade manually in under a minute.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 3 -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;width:100%;">
                <tr>
                  <td style="width:32px;vertical-align:top;padding-top:2px;">
                    <div style="width:24px;height:24px;background:rgba(16,185,129,0.12);border-radius:6px;text-align:center;line-height:24px;font-size:11px;font-weight:700;color:#10B981;">3</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="font-size:13px;font-weight:600;color:#F1F1F3;margin:0 0 3px;">Check your Reports</p>
                    <p style="font-size:12px;color:#9999AA;margin:0;line-height:1.6;">Head to the Reports tab — 7 tabs, 25+ metrics. You'll start seeing patterns you never noticed before.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="https://sleektrade.app/dashboard"
                      style="display:inline-block;background:#10B981;color:#000;font-size:14px;font-weight:700;text-decoration:none;padding:13px 36px;border-radius:9px;letter-spacing:-0.01em;">
                      Go to your dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:#252530;margin:32px 0 24px;"></div>

              <!-- Personal note -->
              <p style="font-size:12px;color:#9999AA;line-height:1.7;margin:0;">
                If you have any questions, feedback, or just want to say hi — reply to this email directly. I read every message personally.
              </p>
              <p style="font-size:12px;color:#9999AA;margin:16px 0 0;">
                Trade well,<br/>
                <span style="color:#F1F1F3;font-weight:600;">Ahmad</span><br/>
                <span style="color:#606070;">Founder, Sleektrade</span>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="font-size:11px;color:#44444F;margin:0;">
                © 2026 Sleektrade · 
                <a href="https://sleektrade.app/privacy" style="color:#44444F;text-decoration:underline;">Privacy</a> · 
                <a href="https://sleektrade.app/terms" style="color:#44444F;text-decoration:underline;">Terms</a>
              </p>
              <p style="font-size:10px;color:#44444F;margin:6px 0 0;">
                You're receiving this because you created a Sleektrade account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Welcome email error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
