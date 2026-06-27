import { NextResponse } from 'next/server';

const UNIVERSE = [
  'NVDA','PLTR','META','GOOGL','AMZN','AAPL','TSM',
  'SMCI','IONQ','SOUN','MSTR','CRWD','PANW','ARM','AI',
  'RGTI','QUBT','CELH','WOLF','COIN','RIOT','MARA',
  'AMD','AVGO','QCOM','MU','NOW','CRM','SNOW','DDOG',
  'NET','LMT','RTX','AXON','MRNA','TSLA','RIVN','MSFT',
];

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    const cookie = cookieRes.headers.get('set-cookie') || '';

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
      },
    });

    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('<')) return null;
    return { crumb: crumb.trim(), cookie };
  } catch {
    return null;
  }
}

async function fetchQuotes(tickers: string[], crumb: string, cookie: string) {
  const joined = tickers.join(',');
  const fields = 'symbol,longName,shortName,regularMarketPrice,regularMarketPreviousClose,regularMarketChangePercent,preMarketPrice,preMarketChange,preMarketChangePercent,preMarketVolume,postMarketPrice,postMarketChange,postMarketChangePercent,regularMarketVolume,averageDailyVolume10Day,fiftyTwoWeekHigh,fiftyTwoWeekLow,fiftyDayAverage,twoHundredDayAverage,marketCap,floatShares,shortPercentOfFloat,sector,industry,regularMarketDayHigh,regularMarketDayLow';
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&fields=${fields}&crumb=${encodeURIComponent(crumb)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Cookie': cookie,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Yahoo quote error: ${res.status}`);
  const data = await res.json();
  return data?.quoteResponse?.result || [];
}

function calcADR(high52: number, low52: number): number {
  if (!high52 || !low52 || low52 === 0) return 0;
  return ((high52 - low52) / ((high52 + low52) / 2)) / 52 * 100;
}

export async function GET() {
  try {
    const auth = await getYahooCrumb();
    if (!auth) {
      return NextResponse.json({ error: 'Could not authenticate with Yahoo Finance' }, { status: 503 });
    }

    const BATCH = 20;
    const allQuotes: any[] = [];
    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const quotes = await fetchQuotes(UNIVERSE.slice(i, i + BATCH), auth.crumb, auth.cookie);
      allQuotes.push(...quotes);
    }

    const gaps = allQuotes
      .filter(q => q?.regularMarketPrice && q?.regularMarketPreviousClose)
      .map(q => {
        const prePrice  = q.preMarketPrice || q.postMarketPrice || q.regularMarketPrice;
        const prevClose = q.regularMarketPreviousClose;
        const gapPct    = ((prePrice - prevClose) / Math.abs(prevClose)) * 100;
        const floatM    = q.floatShares ? q.floatShares / 1e6 : null;

        return {
          ticker:       q.symbol,
          name:         q.longName || q.shortName || q.symbol,
          gap:          parseFloat(gapPct.toFixed(2)),
          prePrice:     parseFloat(prePrice.toFixed(2)),
          preVol:       Math.round((q.preMarketVolume || 0) / 1000),
          prevClose:    parseFloat(prevClose.toFixed(2)),
          float:        floatM ? parseFloat(floatM.toFixed(1)) : null,
          adr:          parseFloat(calcADR(q.fiftyTwoWeekHigh, q.fiftyTwoWeekLow).toFixed(2)),
          atr:          q.regularMarketDayHigh && q.regularMarketDayLow
            ? parseFloat(((q.regularMarketDayHigh - q.regularMarketDayLow) / q.regularMarketPrice * 100).toFixed(2))
            : 0,
          mktCap:       q.marketCap || null,
          sector:       q.sector    || null,
          industry:     q.industry  || null,
          isPreMarket:  !!q.preMarketPrice,
          isPostMarket: !q.preMarketPrice && !!q.postMarketPrice,
          lastUpdated:  new Date().toISOString(),
        };
      })
      .filter(q => Math.abs(q.gap) >= 0.5)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    return NextResponse.json(gaps, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate' },
    });
  } catch (err: any) {
    console.error('[scanner/gaps]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
