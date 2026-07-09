import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/tokenCrypto'
import { fetchAccounts, fetchFilledOrders } from '@/lib/webullApi'
import { matchWebullExecutions, type WebullExecution } from '@/lib/webullMatcher'
import type { TradeRow } from '@/lib/types'

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

  const markResult = async (status: 'success' | 'error', errorMsg: string | null) => {
    await supabase
      .from('broker_connections')
      .update({ last_synced_at: new Date().toISOString(), last_status: status, last_error: errorMsg })
      .eq('id', connection.id)
  }

  let creds: any
  try {
    creds = JSON.parse(decryptToken(connection.credentials_enc))
  } catch {
    await markResult('error', 'Stored credentials could not be read. Please reconnect your Webull account.')
    return NextResponse.json({ error: 'Stored credentials could not be read. Please reconnect your Webull account.' }, { status: 500 })
  }

  if (creds.tokenStatus !== 'verified' || !creds.accessToken) {
    const msg = 'Your Webull token is not verified yet. Open the Webull App and approve the pending request, or reconnect.'
    await markResult('error', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (creds.tokenExpiresAt && new Date(creds.tokenExpiresAt).getTime() < Date.now()) {
    const msg = 'Your Webull token has expired (tokens expire every 15 days). Please reconnect.'
    await markResult('error', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    const apiCreds = { appKey: creds.appKey, appSecret: creds.appSecret }
    const accounts = await fetchAccounts(apiCreds, creds.accessToken)
    if (accounts.length === 0) throw new Error('No Webull accounts found for this connection.')
    const accountId = accounts[0].accountId

    const orders = await fetchFilledOrders(apiCreds, creds.accessToken, accountId)
    const executions: WebullExecution[] = orders
      .filter(o => o.symbol && o.quantity > 0)
      .map(o => ({
        symbol: o.symbol,
        isBuy: o.side === 'BUY',
        qty: o.quantity,
        price: o.filledPrice,
        date: new Date(o.filledTime),
        commission: o.commission,
      }))
      .filter(e => !isNaN(e.date.getTime()))

    if (executions.length === 0) {
      await markResult('success', null)
      return NextResponse.json({ imported: 0, skippedDuplicates: 0, carriedForward: [] })
    }

    const { data: existingTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)

    const { trades, carriedForward } = await matchWebullExecutions(
      executions, (existingTrades || []) as TradeRow[], user.id, supabase
    )

    let imported = 0
    for (const t of trades) {
      if (t.duplicate) continue
      const { error: insertErr } = await supabase.from('trades').insert({
        user_id: user.id,
        symbol: t.symbol, type: t.type, date: t.date, exit_date: t.exitDate,
        entry: t.entry, exit: t.exit, shares: t.shares, pnl: t.pnl,
        risk: 0, commission: t.commission, setup: null, grade: null,
        tags: [], notes: 'Imported from Webull', screenshot_url: null,
      })
      if (!insertErr) imported++
    }

    await markResult('success', null)
    return NextResponse.json({ imported, skippedDuplicates: trades.length - imported, carriedForward })
  } catch (err: any) {
    const msg = err.message || 'Sync failed for an unknown reason.'
    await markResult('error', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
