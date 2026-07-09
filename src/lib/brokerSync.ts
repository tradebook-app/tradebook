import { decryptToken } from '@/lib/tokenCrypto'
import { parseIBKR } from '@/lib/ibkrParser'
import { fetchTradeTransactions, type TastytradeTransaction } from '@/lib/tastytradeApi'
import { matchTastytradeExecutionsSequential, type TTExecution } from '@/lib/tastytradeMatcher'
import { fetchAccounts as fetchWebullAccounts, fetchFilledOrders } from '@/lib/webullApi'
import { matchWebullExecutions, type WebullExecution } from '@/lib/webullMatcher'
import type { TradeRow } from '@/lib/types'

export type SyncResult = {
  ok: boolean
  imported?: number
  skippedDuplicates?: number
  carriedForward?: { symbol: string; side: string; qty: number }[]
  error?: string
}

async function insertTrades(supabase: any, userId: string, trades: any[], source: string): Promise<number> {
  let imported = 0
  for (const t of trades) {
    if (t.duplicate) continue
    const { error } = await supabase.from('trades').insert({
      user_id: userId,
      symbol: t.symbol, type: t.type, date: t.date, exit_date: t.exitDate,
      entry: t.entry, exit: t.exit, shares: t.shares, pnl: t.pnl,
      risk: 0, commission: t.commission, setup: null, grade: null,
      tags: [], notes: source ? `Imported from ${source}` : null, screenshot_url: null,
    })
    if (!error) imported++
  }
  return imported
}

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

async function fetchFlexStatement(url: string, referenceCode: string, token: string): Promise<string> {
  const maxAttempts = 6
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${url}?q=${encodeURIComponent(referenceCode)}&t=${encodeURIComponent(token)}&v=3`)
    const body = await res.text()
    if (body.trim().startsWith('<FlexStatementResponse')) {
      const errMsg = extractXmlTag(body, 'ErrorMessage')
      if (errMsg && /warming up|generation in progress|try again/i.test(errMsg)) {
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      throw new Error(errMsg || 'IBKR returned an unexpected response instead of report data.')
    }
    return body
  }
  throw new Error('IBKR did not finish generating the report in time. Try syncing again in a minute.')
}

export async function syncIbkrForUser(userId: string, supabase: any, connection: any): Promise<SyncResult> {
  const markResult = async (status: 'success' | 'error', errorMsg: string | null) => {
    await supabase.from('broker_connections')
      .update({ last_synced_at: new Date().toISOString(), last_status: status, last_error: errorMsg })
      .eq('id', connection.id)
  }

  let token: string
  try {
    token = decryptToken(connection.flex_token_enc)
  } catch {
    const msg = 'Stored credentials could not be read. Please reconnect your IBKR account.'
    await markResult('error', msg)
    return { ok: false, error: msg }
  }

  try {
    const { referenceCode, url } = await requestFlexStatement(token, connection.flex_query_id)
    const reportText = await fetchFlexStatement(url, referenceCode, token)

    if (reportText.trim().startsWith('<')) {
      const msg = 'Your Flex Query is returning XML, not CSV. Go back to IBKR → edit your Flex Query → set Format to CSV, then sync again.'
      await markResult('error', msg)
      return { ok: false, error: msg }
    }

    const { data: existingTrades } = await supabase.from('trades').select('*').eq('user_id', userId)

    let parsedResult
    try {
      parsedResult = await parseIBKR(reportText, (existingTrades || []) as TradeRow[], userId, supabase)
    } catch (parseErr: any) {
      await markResult('error', parseErr.message)
      return { ok: false, error: parseErr.message }
    }
    const { trades, carriedForward } = parsedResult
    const imported = await insertTrades(supabase, userId, trades, '')

    await markResult('success', null)
    return { ok: true, imported, skippedDuplicates: trades.length - imported, carriedForward }
  } catch (err: any) {
    const msg = err.message || 'Sync failed for an unknown reason.'
    await markResult('error', msg)
    return { ok: false, error: msg }
  }
}

function resolveTastytradeExecutions(transactions: TastytradeTransaction[]): TTExecution[] {
  const sorted = [...transactions].sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())
  const runningSide: Record<string, 'Long' | 'Short' | null> = {}
  const out: TTExecution[] = []

  for (const tx of sorted) {
    const actionLower = (tx.action || '').toLowerCase()
    const isBuy = actionLower.includes('buy')
    let isOpen: boolean

    if (actionLower.includes('open')) isOpen = true
    else if (actionLower.includes('close')) isOpen = false
    else {
      const side = runningSide[tx.symbol]
      const txSide: 'Long' | 'Short' = isBuy ? 'Long' : 'Short'
      isOpen = !side || side === txSide
    }

    runningSide[tx.symbol] = isOpen ? (isBuy ? 'Long' : 'Short') : (runningSide[tx.symbol] ?? null)

    out.push({
      symbol: tx.symbol, isOpen, isBuy,
      qty: tx.quantity, price: tx.price, date: new Date(tx.executedAt),
      commission: tx.commission + tx.clearingFees + tx.regulatoryFees,
    })
  }
  return out
}

export async function syncTastytradeForUser(userId: string, supabase: any, connection: any): Promise<SyncResult> {
  const markResult = async (status: 'success' | 'error', errorMsg: string | null) => {
    await supabase.from('broker_connections')
      .update({ last_synced_at: new Date().toISOString(), last_status: status, last_error: errorMsg })
      .eq('id', connection.id)
  }

  let creds: { clientSecret: string; refreshToken: string; accountNumber: string }
  try {
    creds = JSON.parse(decryptToken(connection.credentials_enc))
  } catch {
    const msg = 'Stored credentials could not be read. Please reconnect your Tastytrade account.'
    await markResult('error', msg)
    return { ok: false, error: msg }
  }

  try {
    const transactions = await fetchTradeTransactions(creds, creds.accountNumber)
    const executions = resolveTastytradeExecutions(transactions)

    if (executions.length === 0) {
      await markResult('success', null)
      return { ok: true, imported: 0, skippedDuplicates: 0, carriedForward: [] }
    }

    const { data: existingTrades } = await supabase.from('trades').select('*').eq('user_id', userId)
    const { trades, carriedForward } = await matchTastytradeExecutionsSequential(
      executions, (existingTrades || []) as TradeRow[], userId, supabase
    )
    const imported = await insertTrades(supabase, userId, trades, 'Tastytrade')

    await markResult('success', null)
    return { ok: true, imported, skippedDuplicates: trades.length - imported, carriedForward }
  } catch (err: any) {
    const msg = err.message || 'Sync failed for an unknown reason.'
    await markResult('error', msg)
    return { ok: false, error: msg }
  }
}

export async function syncWebullForUser(userId: string, supabase: any, connection: any): Promise<SyncResult> {
  const markResult = async (status: 'success' | 'error', errorMsg: string | null) => {
    await supabase.from('broker_connections')
      .update({ last_synced_at: new Date().toISOString(), last_status: status, last_error: errorMsg })
      .eq('id', connection.id)
  }

  let creds: any
  try {
    creds = JSON.parse(decryptToken(connection.credentials_enc))
  } catch {
    const msg = 'Stored credentials could not be read. Please reconnect your Webull account.'
    await markResult('error', msg)
    return { ok: false, error: msg }
  }

  if (creds.tokenStatus !== 'verified' || !creds.accessToken) {
    const msg = 'Your Webull token is not verified yet. Open the Webull App and approve the pending request, or reconnect.'
    await markResult('error', msg)
    return { ok: false, error: msg }
  }

  if (creds.tokenExpiresAt && new Date(creds.tokenExpiresAt).getTime() < Date.now()) {
    const msg = 'Your Webull token has expired (tokens expire every 15 days). Please reconnect.'
    await markResult('error', msg)
    return { ok: false, error: msg }
  }

  try {
    const apiCreds = { appKey: creds.appKey, appSecret: creds.appSecret }
    const accounts = await fetchWebullAccounts(apiCreds, creds.accessToken)
    if (accounts.length === 0) throw new Error('No Webull accounts found for this connection.')
    const accountId = accounts[0].accountId

    const orders = await fetchFilledOrders(apiCreds, creds.accessToken, accountId)
    const executions: WebullExecution[] = orders
      .filter(o => o.symbol && o.quantity > 0)
      .map(o => ({
        symbol: o.symbol, isBuy: o.side === 'BUY',
        qty: o.quantity, price: o.filledPrice, date: new Date(o.filledTime),
        commission: o.commission,
      }))
      .filter(e => !isNaN(e.date.getTime()))

    if (executions.length === 0) {
      await markResult('success', null)
      return { ok: true, imported: 0, skippedDuplicates: 0, carriedForward: [] }
    }

    const { data: existingTrades } = await supabase.from('trades').select('*').eq('user_id', userId)
    const { trades, carriedForward } = await matchWebullExecutions(
      executions, (existingTrades || []) as TradeRow[], userId, supabase
    )
    const imported = await insertTrades(supabase, userId, trades, 'Webull')

    await markResult('success', null)
    return { ok: true, imported, skippedDuplicates: trades.length - imported, carriedForward }
  } catch (err: any) {
    const msg = err.message || 'Sync failed for an unknown reason.'
    await markResult('error', msg)
    return { ok: false, error: msg }
  }
}
