import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/tokenCrypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { flexToken, flexQueryId } = await request.json()
  if (!flexToken || !flexToken.trim()) {
    return NextResponse.json({ error: 'Flex Web Service token is required.' }, { status: 400 })
  }
  if (!flexQueryId || !flexQueryId.trim()) {
    return NextResponse.json({ error: 'Flex Query ID is required.' }, { status: 400 })
  }

  let flexTokenEnc: string
  try {
    flexTokenEnc = encryptToken(flexToken.trim())
  } catch (err: any) {
    console.error('Token encryption error:', err)
    return NextResponse.json({ error: 'Server is not configured to store credentials. Contact support.' }, { status: 500 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'IBKR',
      flex_token_enc: flexTokenEnc,
      flex_query_id: flexQueryId.trim(),
      last_status: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,broker' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
