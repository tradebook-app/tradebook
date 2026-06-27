import { NextResponse } from 'next/server';

const THEMES: Record<string, string[]> = {
  'AI / Machine Learning':  ['NVDA','PLTR','AI','MSFT','GOOGL','AMZN'],
  'Semiconductors':         ['NVDA','AMD','AVGO','QCOM','MU','TSM','ARM'],
  'Quantum Computing':      ['IONQ','RGTI','QUBT'],
  'Cybersecurity':          ['CRWD','PANW','ZS','NET','S'],
  'Bitcoin / Crypto':       ['MSTR','COIN','RIOT','MARA'],
  'Cloud Software':         ['CRM','NOW','SNOW','DDOG','NET'],
  'Defense & Aerospace':    ['LMT','RTX','NOC','GD','AXON'],
  'Biotech / Genomics':     ['MRNA','CRSP','NTLA'],
  'EV / Clean Energy':      ['TSLA','RIVN','PLUG','FSLR'],
  'Gold Miners':            ['NEM','AEM','WPM','GOLD'],
  'Banks & Financials':     ['JPM','GS','BAC','WFC','MS'],
  'Social Media':           ['META','SNAP','PINS'],
  'Retail / Consumer':      ['AMZN','TGT','WMT','COST'],
  'Real Estate':            ['AMT','PLD','SPG','EQIX'],
  'Robotics / Automation':  ['ISRG','ROK','EMR'],
};

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
  const fields = 'symbol,longName,shortName,regularMarketPrice,regularMarketChangePercent,fiftyDayAverage,twoHundredDayAverage,fiftyTwoWeekLow,fiftyTwoWeekHigh';
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(',')}&fields=${fields}&crumb=${encodeURIComponent(crumb)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Cookie': cookie, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Yahoo error: ${res.status}`);
  const data = await res.json();
  return data?.quoteResponse?.result || [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';

    const auth = await getYahooCrumb();
    if (!auth) return NextResponse.json({ error: 'Could not authenticate with Yahoo Finance' }, { status: 503 });

    const allTickers = [...new Set(Object.values(THEMES).flat())];
    const BATCH = 20;
    const allQuotes: any[] = [];
    for (let i = 0; i < allTickers.length; i += BATCH) {
      const quotes = await fetchQuotes(allTickers.slice(i, i + BATCH), auth.crumb, auth.cookie);
      allQuotes.push(...quotes);
    }
    const quoteMap = Object.fromEntries(allQuotes.map(q => [q.symbol, q]));

    const themeResults = Object.entries(THEMES).map(([themeName, tickers]) => {
      const stockData = tickers.map(ticker => {
        const q = quoteMap[ticker];
        if (!q?.regularMarketPrice) return null;
        const price = q.regularMarketPrice;
        const d50   = q.fiftyDayAverage;
        const d200  = q.twoHundredDayAverage;
        const l52   = q.fiftyTwoWeekLow;

        let pct = 0;
        if (period === 'today')    pct = q.regularMarketChangePercent || 0;
        else if (period === '1w')  pct = (q.regularMarketChangePercent || 0) * 5;
        else if (period === '1m')  pct = d50  ? ((price - d50)  / Math.abs(d50))  * 100 : 0;
        else if (period === 'ytd') pct = l52  ? ((price - l52)  / Math.abs(l52))  * 100 * 0.6 : 0;

        return {
          t: ticker,
          n: q.longName || q.shortName || ticker,
          p: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
          pctVal: pct,
          price: parseFloat(price.toFixed(2)),
        };
      }).filter(Boolean) as any[];

      const avgPct = stockData.length
        ? stockData.reduce((s, d) => s + d.pctVal, 0) / stockData.length : 0;

      return {
        name:   themeName,
        pct:    parseFloat(avgPct.toFixed(2)),
        stocks: stockData.sort((a, b) => b.pctVal - a.pctVal).slice(0, 5),
        period,
      };
    });

    return NextResponse.json(themeResults.sort((a, b) => b.pct - a.pct), {
      headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate' },
    });
  } catch (err: any) {
    console.error('[scanner/themes]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
