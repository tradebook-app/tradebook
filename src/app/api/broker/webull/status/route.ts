import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/tokenCrypto'
import { checkTokenStatus } from '@/lib/webullApi'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'Webull')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || !data.credentials_enc) return NextResponse.json({ connection: null })

  let creds: any
  try {
    creds = JSON.parse(decryptToken(data.credentials_enc))
  } catch {
    return NextResponse.json({ connection: null })
  }

  // If still pending, re-check with Webull — this is what the UI polls while the
  // user approves the request via SMS / the Webull App.
  if (creds.tokenStatus === 'pending') {
    try {
      const fresh = await checkTokenStatus({ appKey: creds.appKey, appSecret: creds.appSecret })
      creds.accessToken = fresh.accessToken
      creds.tokenStatus = fresh.status
      creds.tokenExpiresAt = fresh.expiresAt
      const credentialsEnc = encryptToken(JSON.stringify(creds))
      await supabase.from('broker_connections').update({ credentials_enc: credentialsEnc }).eq('id', data.id)
    } catch {
      // Leave status as-is if the check itself fails transiently
    }
  }

  return NextResponse.json({
    connection: {
      tokenStatus: creds.tokenStatus,
      tokenExpiresAt: creds.tokenExpiresAt,
      last_synced_at: data.last_synced_at,
      last_status: data.last_status,
      last_error: data.last_error,
      created_at: data.created_at,
    },
  })
}
