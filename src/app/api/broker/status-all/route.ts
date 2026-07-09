import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('broker_connections')
    .select('broker, last_synced_at, last_status, last_error')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const connections = (data || []).map(c => ({
    broker: c.broker,
    lastSyncedAt: c.last_synced_at,
    lastStatus: c.last_status,
    lastError: c.last_error,
  }))

  return NextResponse.json({ connections })
}
