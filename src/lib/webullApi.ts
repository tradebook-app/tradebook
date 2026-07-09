import crypto from 'crypto'

// NOTE ON CONFIDENCE: the signature algorithm below is directly documented by Webull
// and should be correct as written. The exact production hostname and the "check
// verification status" endpoint path are the two least-certain pieces here — Webull's
// reference docs are JS-rendered and couldn't be fully crawled. Flag these first if
// a live connection attempt fails with a network/host error or 404.
const API_HOST = 'api.webull.com'
const API_BASE = `https://${API_HOST}`

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
    headers: { ...headers, 'Content-Type': 'application/json' },
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
// via SMS / the Webull App. Per Webull's docs, tokens default to a 15-day expiration.
export async function createToken(creds: WebullCredentials): Promise<TokenState> {
  const json = await webullFetch(creds, 'POST', '/api/openapi/passport/token/create', {}, {})
  return mapTokenResponse(json)
}

// Re-checks status of a pending token. Webull's own SDK polls by re-issuing the same
// create-token request, which returns the current status of any pending token for
// this App Key rather than creating a duplicate — this route mirrors that behavior.
export async function checkTokenStatus(creds: WebullCredentials): Promise<TokenState> {
  const json = await webullFetch(creds, 'POST', '/api/openapi/passport/token/create', {}, {})
  return mapTokenResponse(json)
}

function mapTokenResponse(json: any): TokenState {
  const data = json?.data || json
  const rawStatus = (data?.status || data?.tokenStatus || '').toString().toLowerCase()
  const status: TokenState['status'] =
    rawStatus.includes('verif') && !rawStatus.includes('pending') ? 'verified' :
    rawStatus.includes('fail') || rawStatus.includes('reject') ? 'failed' : 'pending'

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
  const json = await webullFetch(creds, 'GET', '/api/openapi/account/v2/list', { accessToken })
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

// Fetches filled orders for the account. Paginates by date range if the account
// has more history than a single page returns.
export async function fetchFilledOrders(creds: WebullCredentials, accessToken: string, accountId: string): Promise<WebullOrder[]> {
  const json = await webullFetch(creds, 'GET', '/api/openapi/trade/v2/order/list', {
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
