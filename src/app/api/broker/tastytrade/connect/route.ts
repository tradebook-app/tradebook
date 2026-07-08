import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/tokenCrypto'
import { fetchAccounts } from '@/lib/tastytradeApi'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { clientSecret, refreshToken } = await request.json()
  if (!clientSecret?.trim() || !refreshToken?.trim()) {
    return NextResponse.json({ error: 'Client Secret and Refresh Token are both required.' }, { status: 400 })
  }

  let accountNumber: string
  try {
    const accounts = await fetchAccounts({ clientSecret: clientSecret.trim(), refreshToken: refreshToken.trim() })
    if (accounts.length === 0) throw new Error('No Tastytrade accounts found for these credentials.')
    // If more than one account exists, use the first for now (multi-account selection can be added later).
    accountNumber = accounts[0].accountNumber
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not verify credentials with Tastytrade.' }, { status: 400 })
  }

  let credentialsEnc: string
  try {
    credentialsEnc = encryptToken(JSON.stringify({ clientSecret: clientSecret.trim(), refreshToken: refreshToken.trim(), accountNumber }))
  } catch (err: any) {
    console.error('Credential encryption error:', err)
    return NextResponse.json({ error: 'Server is not configured to store credentials. Contact support.' }, { status: 500 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'Tastytrade',
      flex_token_enc: null,
      flex_query_id: null,
      credentials_enc: credentialsEnc,
      last_status: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,broker' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, accountNumber })
}
