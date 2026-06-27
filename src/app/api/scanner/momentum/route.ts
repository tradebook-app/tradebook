import { NextResponse } from 'next/server';

const UNIVERSE = [
  'NVDA','PLTR','META','GOOGL','AMZN','AAPL','TSM',
  'SMCI','IONQ','SOUN','MSTR','CRWD','PANW','ARM','AI',
  'RGTI','QUBT','CELH','WOLF','COIN','RIOT','MARA',
  'AMD','AVGO','QCOM','MU','NOW','CRM','SNOW','DDOG',
  'NET','LMT','RTX','AXON','MRNA','TSLA','RIVN','MSFT',
];

function rank99(value: number, arr: number[], higherBetter = true): number {
  if (!arr.length) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= value);
  const raw = idx === -1 ? sorted.length : idx;
  const pct = raw / sorted.length;
  return Math.max(1, Math.min(99, Math.round(higherBetter ? pct * 99 : (1 - pct) * 99)));
}

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'follow',
    });
    const cookie = cookieRes.headers.get('set-cookie') || '';
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Cookie': cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('<')) return null;
    return { crumb: crumb.trim(), cookie };
  } catch { return null; }
}

async function fetchQuotes(tickers: string[], crumb: string, cookie: string) {
  const fields = 'symbol,longName,shortName,regularMarketPrice,regularMarketChangePercent,regularMarketVolume,averageDailyVolume3Month,fiftyTwoWeekHigh,fiftyTwoWeekLow,fiftyDayAverage,twoHundredDayAverage,marketCap,sector,industry,regularMarketDayHigh,regularMarketDayLow';
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(',')}&fields=${fields}&crumb=${encodeURIComponent(crumb)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Cookie': cookie, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Yahoo error: ${res.status}`);
  const data = await res.json();
  return data?.quoteResponse?.result || [];
}

export async function GET() {
  try {
    const auth = await getYahooCrumb();
    if (!auth) return NextResponse.json({ error: 'Could not authenticate with Yahoo Finance' }, { status: 503 });

    const BATCH = 20;
    const allQuotes: any[] = [];
    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const quotes = await fetchQuotes(UNIVERSE.slice(i, i + BATCH), auth.crumb, auth.cookie);
      allQuotes.push(...quotes);
    }

    const results = allQuotes
      .filter(q => q?.regularMarketPrice)
      .map(q => {
        const price = q.regularMarketPrice;
        const d50   = q.fiftyDayAverage;
        const d200  = q.twoHundredDayAverage;
        const h52   = q.fiftyTwoWeekHigh;
        const l52   = q.fiftyTwoWeekLow;

        const m1 = d50  ? ((price - d50)  / Math.abs(d50))  * 100 * 0.8 : 0;
        const m3 = d50  ? ((price - d50)  / Math.abs(d50))  * 100 * 1.2 : 0;
        const m6 = d200 ? ((price - d200) / Math.abs(d200)) * 100       : 0;
        const adr = h52 && l52 ? ((h52 - l52) / ((h52 + l52) / 2)) / 52 * 100 : 0;
        const atrPct = q.regularMarketDayHigh && q.regularMarketDayLow
          ? ((q.regularMarketDayHigh - q.regularMarketDayLow) / price) * 100 : 0;

        return {
          ticker:   q.symbol,
          name:     q.longName || q.shortName || q.symbol,
          price:    parseFloat(price.toFixed(2)),
          m1:       parseFloat(m1.toFixed(1)),
          m3:       parseFloat(m3.toFixed(1)),
          m6:       parseFloat(m6.toFixed(1)),
          adr:      parseFloat(adr.toFixed(2)),
          atrPct:   parseFloat(atrPct.toFixed(2)),
          d50:      d50  ? parseFloat(d50.toFixed(2))  : null,
          d200:     d200 ? parseFloat(d200.toFixed(2)) : null,
          h52:      h52  ? parseFloat(h52.toFixed(2))  : null,
          l52:      l52  ? parseFloat(l52.toFixed(2))  : null,
          volume:   q.regularMarketVolume || 0,
          avgVol:   q.averageDailyVolume3Month || 0,
          mktCap:   q.marketCap  || null,
          sector:   q.sector     || null,
          industry: q.industry   || null,
        };
      });

    const allM6 = results.map(r => r.m6);
    const ranked = results
      .map(r => ({ ...r, rs: rank99(r.m6, allM6, true) }))
      .sort((a, b) => b.rs - a.rs);

    return NextResponse.json(ranked, {
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate' },
    });
  } catch (err: any) {
    console.error('[scanner/momentum]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
