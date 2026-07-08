import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/tokenCrypto'
import { fetchTradeTransactions, type TastytradeTransaction } from '@/lib/tastytradeApi'
import { matchTastytradeExecutionsSequential, type TTExecution } from '@/lib/tastytradeMatcher'
import type { TradeRow } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Resolve open/close intent for every transaction before matching.
// Most stock/option actions are explicit ('Buy to Open', 'Sell to Close', etc).
// Bare 'Buy'/'Sell' (seen on some futures transactions) don't say open or close —
// for those, infer using a running per-symbol position side, same idea as the IBKR importer.
function resolveExecutions(transactions: TastytradeTransaction[]): TTExecution[] {
  const sorted = [...transactions].sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())
  const runningSide: Record<string, 'Long' | 'Short' | null> = {}
  const out: TTExecution[] = []

  for (const tx of sorted) {
    const actionLower = (tx.action || '').toLowerCase()
    const isBuy = actionLower.includes('buy')
    let isOpen: boolean

    if (actionLower.includes('open')) {
      isOpen = true
    } else if (actionLower.includes('close')) {
      isOpen = false
    } else {
      // Ambiguous (bare Buy/Sell) — infer from running position side for this symbol
      const side = runningSide[tx.symbol]
      const txSide: 'Long' | 'Short' = isBuy ? 'Long' : 'Short'
      isOpen = !side || side === txSide
    }

    runningSide[tx.symbol] = isOpen ? (isBuy ? 'Long' : 'Short') : (runningSide[tx.symbol] ?? null)

    out.push({
      symbol: tx.symbol,
      isOpen,
      isBuy,
      qty: tx.quantity,
      price: tx.price,
      date: new Date(tx.executedAt),
      commission: tx.commission + tx.clearingFees + tx.regulatoryFees,
    })
  }

  return out
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: connection, error: connErr } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'Tastytrade')
    .maybeSingle()

  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 })
  if (!connection || !connection.credentials_enc) {
    return NextResponse.json({ error: 'No Tastytrade connection found. Connect your account first.' }, { status: 400 })
  }

  const markResult = async (status: 'success' | 'error', errorMsg: string | null) => {
    await supabase
      .from('broker_connections')
      .update({ last_synced_at: new Date().toISOString(), last_status: status, last_error: errorMsg })
      .eq('id', connection.id)
  }

  let creds: { clientSecret: string; refreshToken: string; accountNumber: string }
  try {
    creds = JSON.parse(decryptToken(connection.credentials_enc))
  } catch {
    await markResult('error', 'Stored credentials could not be read. Please reconnect your Tastytrade account.')
    return NextResponse.json({ error: 'Stored credentials could not be read. Please reconnect your Tastytrade account.' }, { status: 500 })
  }

  try {
    const transactions = await fetchTradeTransactions(creds, creds.accountNumber)
    const executions = resolveExecutions(transactions)

    if (executions.length === 0) {
      await markResult('success', null)
      return NextResponse.json({ imported: 0, skippedDuplicates: 0, carriedForward: [] })
    }

    const { data: existingTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)

    const { trades, carriedForward } = await matchTastytradeExecutionsSequential(
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
        tags: [], notes: 'Imported from Tastytrade', screenshot_url: null,
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
