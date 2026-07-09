import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/tokenCrypto'
import { createToken } from '@/lib/webullApi'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { appKey, appSecret } = await request.json()
  if (!appKey?.trim() || !appSecret?.trim()) {
    return NextResponse.json({ error: 'App Key and App Secret are both required.' }, { status: 400 })
  }

  let tokenState
  try {
    tokenState = await createToken({ appKey: appKey.trim(), appSecret: appSecret.trim() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not reach Webull. Check your App Key and App Secret.' }, { status: 400 })
  }

  let credentialsEnc: string
  try {
    credentialsEnc = encryptToken(JSON.stringify({
      appKey: appKey.trim(),
      appSecret: appSecret.trim(),
      accessToken: tokenState.accessToken,
      tokenStatus: tokenState.status,
      tokenExpiresAt: tokenState.expiresAt,
    }))
  } catch (err: any) {
    console.error('Credential encryption error:', err)
    return NextResponse.json({ error: 'Server is not configured to store credentials. Contact support.' }, { status: 500 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'Webull',
      flex_token_enc: null,
      flex_query_id: null,
      credentials_enc: credentialsEnc,
      last_status: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,broker' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tokenStatus: tokenState.status })
}
