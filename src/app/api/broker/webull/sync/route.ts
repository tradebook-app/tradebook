import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncWebullForUser } from '@/lib/brokerSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: connection, error: connErr } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'Webull')
    .maybeSingle()

  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 })
  if (!connection || !connection.credentials_enc) {
    return NextResponse.json({ error: 'No Webull connection found. Connect your account first.' }, { status: 400 })
  }

  const result = await syncWebullForUser(user.id, supabase, connection)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ imported: result.imported, skippedDuplicates: result.skippedDuplicates, carriedForward: result.carriedForward })
}
