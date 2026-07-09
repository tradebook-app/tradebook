import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncIbkrForUser, syncTastytradeForUser, syncWebullForUser } from '@/lib/brokerSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: connections, error } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!connections || connections.length === 0) {
    return NextResponse.json({ error: 'No broker connections found.' }, { status: 400 })
  }

  const results: { broker: string; ok: boolean; imported?: number; error?: string }[] = []

  for (const conn of connections) {
    try {
      let result
      if (conn.broker === 'IBKR')            result = await syncIbkrForUser(user.id, supabase, conn)
      else if (conn.broker === 'Tastytrade') result = await syncTastytradeForUser(user.id, supabase, conn)
      else if (conn.broker === 'Webull')     result = await syncWebullForUser(user.id, supabase, conn)
      else continue

      results.push({ broker: conn.broker, ok: result.ok, imported: result.imported, error: result.error })
    } catch (err: any) {
      results.push({ broker: conn.broker, ok: false, error: err.message || 'Unknown error' })
    }
  }

  const totalImported = results.reduce((s, r) => s + (r.imported || 0), 0)
  return NextResponse.json({ results, totalImported })
}
