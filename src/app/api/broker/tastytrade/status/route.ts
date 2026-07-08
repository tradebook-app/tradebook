import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/tokenCrypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('broker_connections')
    .select('credentials_enc, last_synced_at, last_status, last_error, created_at')
    .eq('user_id', user.id)
    .eq('broker', 'Tastytrade')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ connection: null })

  let accountNumber: string | null = null
  try {
    if (data.credentials_enc) accountNumber = JSON.parse(decryptToken(data.credentials_enc)).accountNumber
  } catch {}

  return NextResponse.json({
    connection: {
      accountNumber,
      last_synced_at: data.last_synced_at,
      last_status: data.last_status,
      last_error: data.last_error,
      created_at: data.created_at,
    },
  })
}
