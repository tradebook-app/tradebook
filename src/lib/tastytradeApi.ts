const API_URL = 'https://api.tastytrade.com'

export type TastytradeCredentials = {
  clientSecret: string
  refreshToken: string
}

async function refreshAccessToken(creds: TastytradeCredentials): Promise<string> {
  const res = await fetch(`${API_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // The raw nginx-style "401 Authorization Required" HTML page (as opposed to
      // Tastytrade's normal JSON error body) suggests requests without a real
      // User-Agent get blocked at a gateway level before reaching the actual API.
      // The endpoint path and request body here already match Tastytrade's own
      // Python SDK exactly, so this header is the most likely remaining gap.
      'User-Agent': 'Sleektrade/1.0 (+https://sleektrade.app)',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Tastytrade rejected the connection (${res.status}). Check your Client Secret and Refresh Token. ${body.substring(0, 200)}`)
  }
  const data = await res.json()
  if (!data.access_token) throw new Error('Tastytrade did not return an access token.')
  return data.access_token
}

async function ttFetch(accessToken: string, path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${API_URL}${path}`)
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'Sleektrade/1.0 (+https://sleektrade.app)',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Tastytrade API error (${res.status}): ${body.substring(0, 300)}`)
  }
  return res.json()
}

export type TastytradeAccount = {
  accountNumber: string
  nickname: string
}

export async function fetchAccounts(creds: TastytradeCredentials): Promise<TastytradeAccount[]> {
  const token = await refreshAccessToken(creds)
  const json = await ttFetch(token, '/customers/me/accounts')
  const items = json?.data?.items || []
  return items.map((it: any) => ({
    accountNumber: it.account?.['account-number'],
    nickname: it.account?.nickname || it.account?.['account-number'],
  })).filter((a: TastytradeAccount) => a.accountNumber)
}

export type TastytradeTransaction = {
  symbol: string
  action: string | null       // 'Buy to Open' | 'Sell to Close' | 'Sell to Open' | 'Buy to Close' | 'Buy' | 'Sell' | null
  quantity: number
  price: number
  commission: number
  clearingFees: number
  regulatoryFees: number
  executedAt: string
  transactionType: string
  instrumentType: string | null
}

// Fetches all 'Trade' type transactions for an account, paginating through results.
export async function fetchTradeTransactions(
  creds: TastytradeCredentials,
  accountNumber: string,
  startDate?: string // yyyy-mm-dd
): Promise<TastytradeTransaction[]> {
  const token = await refreshAccessToken(creds)
  const results: TastytradeTransaction[] = []
  let pageOffset = 0
  const perPage = 250

  while (true) {
    const params: Record<string, string> = {
      'per-page': String(perPage),
      'page-offset': String(pageOffset),
      'type': 'Trade',
      'sort': 'Asc',
    }
    if (startDate) params['start-date'] = startDate

    const json = await ttFetch(token, `/accounts/${accountNumber}/transactions`, params)
    const items = json?.data?.items || []

    for (const it of items) {
      // Skip non-equity/option/future trade legs that don't represent a fill (e.g. adjustments)
      if (!it.symbol || it.quantity == null || it.price == null) continue
      results.push({
        symbol: String(it.symbol).toUpperCase(),
        action: it.action || null,
        quantity: Math.abs(parseFloat(it.quantity)) || 0,
        price: Math.abs(parseFloat(it.price)) || 0,
        commission: Math.abs(parseFloat(it.commission)) || 0,
        clearingFees: Math.abs(parseFloat(it['clearing-fees'])) || 0,
        regulatoryFees: Math.abs(parseFloat(it['regulatory-fees'])) || 0,
        executedAt: it['executed-at'],
        transactionType: it['transaction-type'],
        instrumentType: it['instrument-type'] || null,
      })
    }

    const pagination = json?.pagination
    if (!pagination || pagination['page-offset'] >= pagination['total-pages'] - 1) break
    pageOffset++
  }

  return results
}
