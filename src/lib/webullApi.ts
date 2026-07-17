import crypto from 'crypto'

// Host + endpoint paths below were confirmed directly against developer.webull.com's
// published API reference (create-token, check-token, account-list, order-history) on
// 2026-07-17.
//
// HOST: this took two attempts to get right. Individually-issued App Key/Secret pairs
// (the kind generated from "Register an API Application" in the developer portal —
// which is what a real user has, even for a PaperTrade-approved application) are meant
// to hit the PRODUCTION host, 'api.webull.com'. Webull's backend already knows the key
// is scoped to a paper account from the application approval itself — it doesn't need
// a different URL for that. The sandbox host ('api.sandbox.webull.com') is for a
// different thing entirely: Webull's own generic, publicly-shared test credentials that
// anyone can use without an approved application. Using a real per-user key against the
// sandbox host returns 401 "invalid credentials... ensure you are connecting to the
// correct environment" — which is exactly what happened when this was tried.
const API_HOST = 'api.webull.com'
const API_BASE = `https://${API_HOST}`

// REMAINING UNCERTAINTY: the docs confirm the paths above and that requests need
// 'x-app-key' + signature headers, but didn't show the exact header/param name for
// passing the access token on authenticated calls (fetchAccounts / fetchFilledOrders
// below still send it as an 'accessToken' query param, unconfirmed). If createToken /
// checkTokenStatus succeed but fetchAccounts or fetchFilledOrders fail with 401/404,
// this is the next thing to check.

export type WebullCredentials = {
  appKey: string
  appSecret: string
}

function signRequest(
  creds: WebullCredentials,
  uri: string,
  queryParams: Record<string, string>,
  body: string | null,
  nonce: string,
  timestamp: string
): { headers: Record<string, string> } {
  const headerFields: Record<string, string> = {
    'x-app-key': creds.appKey,
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-version': '1.0',
    'x-signature-nonce': nonce,
    'x-timestamp': timestamp,
    host: API_HOST,
  }

  const combined: Record<string, string> = { ...queryParams, ...headerFields }
  const sortedKeys = Object.keys(combined).sort()
  const s1 = sortedKeys.map(k => `${k}=${combined[k]}`).join('&')

  let s3 = `${uri}&${s1}`
  if (body && body.length > 0) {
    const s2 = crypto.createHash('md5').update(body).digest('hex').toUpperCase()
    s3 = `${s3}&${s2}`
  }

  const signature = crypto
    .createHmac('sha1', `${creds.appSecret}&`)
    .update(s3)
    .digest('base64')

  return {
    headers: { ...headerFields, 'x-signature': signature },
  }
}

async function webullFetch(
  creds: WebullCredentials,
  method: 'GET' | 'POST',
  uri: string,
  queryParams: Record<string, string> = {},
  bodyObj: any = null
): Promise<any> {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null

  const { headers } = signRequest(creds, uri, queryParams, bodyStr, nonce, timestamp)

  const url = new URL(`${API_BASE}${uri}`)
  for (const [k, v] of Object.entries(queryParams)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), {
    method,
    headers: { ...headers, 'Content-Type': 'application/json', 'x-version': 'v2' },
    body: bodyStr || undefined,
  })

  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = { raw: text } }

  if (!res.ok) {
    throw new Error(`Webull API error (${res.status}): ${text.substring(0, 300)}`)
  }
  return json
}

export type TokenState = {
  accessToken: string | null
  status: 'pending' | 'verified' | 'failed'
  expiresAt: string | null
}

// Requests a new token. Status starts 'Pending Verification' until the user approves
// via SMS / the Webull App (5-minute window). Per Webull's docs, tokens default to a
// 15-day expiration.
export async function createToken(creds: WebullCredentials): Promise<TokenState> {
  const json = await webullFetch(creds, 'POST', '/openapi/auth/token/create', {}, {})
  return mapTokenResponse(json)
}

// Re-checks status of a pending token via Webull's dedicated check endpoint (separate
// from create — confirmed against their real API reference). Returns NORMAL (verified),
// PENDING (still waiting on phone approval), INVALID, or EXPIRED.
export async function checkTokenStatus(creds: WebullCredentials): Promise<TokenState> {
  const json = await webullFetch(creds, 'POST', '/openapi/auth/token/check', {}, {})
  return mapTokenResponse(json)
}

// Webull's Check Token endpoint documents exactly four status values: NORMAL
// (verified, usable), PENDING (waiting on phone approval), INVALID, EXPIRED.
function mapTokenResponse(json: any): TokenState {
  const data = json?.data || json
  const rawStatus = (data?.status || data?.tokenStatus || '').toString().toUpperCase()
  const status: TokenState['status'] =
    rawStatus === 'NORMAL' ? 'verified' :
    rawStatus === 'PENDING' ? 'pending' :
    rawStatus === 'INVALID' || rawStatus === 'EXPIRED' ? 'failed' :
    // Unrecognized status string — fall back to the old fuzzy match rather than
    // silently treating an unknown value as any particular state.
    (rawStatus.includes('VERIF') && !rawStatus.includes('PEND')) ? 'verified' :
    (rawStatus.includes('FAIL') || rawStatus.includes('REJECT')) ? 'failed' : 'pending'

  return {
    accessToken: data?.accessToken || data?.token || null,
    status,
    expiresAt: data?.expireTime || data?.expiresAt || null,
  }
}

export type WebullAccount = {
  accountId: string
  accountType: string | null
}

export async function fetchAccounts(creds: WebullCredentials, accessToken: string): Promise<WebullAccount[]> {
  const json = await webullFetch(creds, 'GET', '/openapi/account/list', { accessToken })
  const items = json?.data || json?.accounts || []
  return items.map((it: any) => ({
    accountId: it.accountId || it.account_id || it.secAccountId,
    accountType: it.accountType || it.account_type || null,
  })).filter((a: WebullAccount) => a.accountId)
}

export type WebullOrder = {
  symbol: string
  side: string        // 'BUY' | 'SELL'
  quantity: number
  filledPrice: number
  filledTime: string
  commission: number
}

// Fetches filled orders for the account. IMPORTANT LIMITATION (confirmed in Webull's
// own API reference, not a Sleektrade constraint): this endpoint only returns the past
// 7 days of order history, full stop — there's no way to page further back. Auto-sync
// needs to run at least weekly or trades older than 7 days will be silently
// unrecoverable via this endpoint (a manual CSV export would still work for those).
export async function fetchFilledOrders(creds: WebullCredentials, accessToken: string, accountId: string): Promise<WebullOrder[]> {
  const json = await webullFetch(creds, 'GET', '/openapi/trade/order/history', {
    accessToken,
    accountId,
    status: 'FILLED',
  })
  const items = json?.data || json?.orders || []
  return items
    .filter((it: any) => it.symbol && (it.filledQuantity || it.quantity))
    .map((it: any) => ({
      symbol: String(it.symbol).toUpperCase(),
      side: (it.side || it.action || '').toUpperCase(),
      quantity: Math.abs(parseFloat(it.filledQuantity || it.quantity)) || 0,
      filledPrice: Math.abs(parseFloat(it.avgFilledPrice || it.filledPrice || it.price)) || 0,
      filledTime: it.filledTime || it.updateTime || it.createTime,
      commission: Math.abs(parseFloat(it.commission)) || 0,
    }))
}
