import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/tokenCrypto'
import { parseIBKR } from '@/lib/ibkrParser'
import type { TradeRow } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // increase if your Vercel plan allows and reports take longer to generate

const FLEX_BASE = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService'

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? match[1].trim() : null
}

async function requestFlexStatement(token: string, queryId: string): Promise<{ referenceCode: string; url: string }> {
  const res = await fetch(`${FLEX_BASE}/SendRequest?t=${encodeURIComponent(token)}&q=${encodeURIComponent(queryId)}&v=3`)
  const xml = await res.text()

  const status = extractXmlTag(xml, 'Status')
  if (status !== 'Success') {
    const errMsg = extractXmlTag(xml, 'ErrorMessage') || 'IBKR rejected the Flex request. Check your token and Query ID.'
    throw new Error(errMsg)
  }

  const referenceCode = extractXmlTag(xml, 'ReferenceCode')
  const url = extractXmlTag(xml, 'Url')
  if (!referenceCode || !url) throw new Error('IBKR response did not include a reference code or retrieval URL.')

  return { referenceCode, url }
}

// IBKR may still be generating the report — retry a few times before giving up.
async function fetchFlexStatement(url: string, referenceCode: string, token: string): Promise<string> {
  const maxAttempts = 6
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${url}?q=${encodeURIComponent(referenceCode)}&t=${encodeURIComponent(token)}&v=3`)
    const body = await res.text()

    // A still-generating or error response comes back wrapped in <FlexStatementResponse>...</FlexStatementResponse>
    if (body.trim().startsWith('<FlexStatementResponse')) {
      const errMsg = extractXmlTag(body, 'ErrorMessage')
      if (errMsg && /warming up|generation in progress|try again/i.test(errMsg)) {
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      throw new Error(errMsg || 'IBKR returned an unexpected response instead of report data.')
    }

    return body // actual CSV (or XML) report data
  }
  throw new Error('IBKR did not finish generating the report in time. Try syncing again in a minute.')
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: connection, error: connErr } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'IBKR')
    .maybeSingle()

  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 })
  if (!connection) return NextResponse.json({ error: 'No IBKR connection found. Connect your account first.' }, { status: 400 })

  const markResult = async (status: 'success' | 'error', errorMsg: string | null) => {
    await supabase
      .from('broker_connections')
      .update({ last_synced_at: new Date().toISOString(), last_status: status, last_error: errorMsg })
      .eq('id', connection.id)
  }

  let token: string
  try {
    token = decryptToken(connection.flex_token_enc)
  } catch (err: any) {
    await markResult('error', 'Stored credentials could not be read. Please reconnect your IBKR account.')
    return NextResponse.json({ error: 'Stored credentials could not be read. Please reconnect your IBKR account.' }, { status: 500 })
  }

  try {
    const { referenceCode, url } = await requestFlexStatement(token, connection.flex_query_id)
    const reportText = await fetchFlexStatement(url, referenceCode, token)

    const { data: existingTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)

    const { trades, carriedForward } = await parseIBKR(reportText, (existingTrades || []) as TradeRow[], user.id, supabase)

    let imported = 0
    for (const t of trades) {
      if (t.duplicate) continue
      const { error: insertErr } = await supabase.from('trades').insert({
        user_id: user.id,
        symbol: t.symbol, type: t.type, date: t.date, exit_date: t.exitDate,
        entry: t.entry, exit: t.exit, shares: t.shares, pnl: t.pnl,
        risk: 0, commission: t.commission, setup: null, grade: null,
        tags: [], notes: null, screenshot_url: null,
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
