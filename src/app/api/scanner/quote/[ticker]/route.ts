import { NextResponse } from 'next/server';

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

export async function GET(request: Request, { params }: { params: { ticker: string } }) {
  try {
    const ticker = params.ticker.toUpperCase();
    const auth = await getYahooCrumb();
    if (!auth) return NextResponse.json({ error: 'Could not authenticate with Yahoo Finance' }, { status: 503 });

    const fields = 'symbol,longName,shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,preMarketPrice,preMarketChange,preMarketChangePercent,preMarketVolume,postMarketPrice,postMarketChange,postMarketChangePercent,regularMarketVolume,averageDailyVolume3Month,fiftyTwoWeekHigh,fiftyTwoWeekLow,fiftyDayAverage,twoHundredDayAverage,marketCap,floatShares,shortPercentOfFloat,sector,industry,regularMarketDayHigh,regularMarketDayLow';
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&fields=${fields}&crumb=${encodeURIComponent(auth.crumb)}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Cookie': auth.cookie, 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Yahoo error: ${res.status}`);
    const data = await res.json();
    const quote = data?.quoteResponse?.result?.[0];
    if (!quote) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });

    return NextResponse.json({ quote });
  } catch (err: any) {
    console.error('[scanner/quote]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
