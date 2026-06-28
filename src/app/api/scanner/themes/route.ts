import { NextResponse } from 'next/server';

const FMP = 'https://financialmodelingprep.com';
const KEY = process.env.FMP_API_KEY;

const THEMES: Record<string, string[]> = {
  'AI / Machine Learning':  ['NVDA','PLTR','AI','MSFT','GOOGL','AMZN'],
  'Semiconductors':         ['NVDA','AMD','AVGO','QCOM','MU','TSM','ARM'],
  'Quantum Computing':      ['IONQ','RGTI','QUBT'],
  'Cybersecurity':          ['CRWD','PANW','ZS','NET','S'],
  'Bitcoin / Crypto':       ['MSTR','COIN','RIOT','MARA'],
  'Cloud Software':         ['CRM','NOW','SNOW','DDOG','NET'],
  'Defense & Aerospace':    ['LMT','RTX','NOC','GD','AXON'],
  'Biotech / Genomics':     ['MRNA','CRSP','NTLA'],
  'EV / Clean Energy':      ['TSLA','RIVN','LCID','PLUG','FSLR'],
  'Gold Miners':            ['NEM','AEM','WPM','GOLD'],
  'Banks & Financials':     ['JPM','GS','BAC','WFC','MS'],
  'Social Media':           ['META','SNAP','PINS'],
  'Retail / Consumer':      ['AMZN','TGT','WMT','COST'],
  'Real Estate':            ['AMT','PLD','SPG','EQIX'],
  'Robotics / Automation':  ['ISRG','ROK','EMR'],
};

async function batchQuote(symbols: string[]) {
  const url = `${FMP}/stable/batch-quote?symbols=${symbols.join(',')}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  return res.json();
}

async function priceChange(symbol: string) {
  const url = `${FMP}/stable/stock-price-change?symbol=${symbol}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function GET(request: Request) {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';

    const allTickers = [...new Set(Object.values(THEMES).flat())];
    const quotes = await batchQuote(allTickers);
    const quoteMap: Record<string, any> = {};
    for (const q of (quotes || [])) quoteMap[q.symbol] = q;

    // For non-today periods, fetch real price changes
    let changeMap: Record<string, any> = {};
    if (period !== 'today') {
      const BATCH = 8;
      for (let i = 0; i < allTickers.length; i += BATCH) {
        const batch = allTickers.slice(i, i + BATCH);
        await Promise.all(batch.map(async (t) => {
          const chg = await priceChange(t);
          if (chg) changeMap[t] = chg;
        }));
      }
    }

    const themeResults = Object.entries(THEMES).map(([themeName, tickers]) => {
      const stockData = tickers.map(ticker => {
        const q = quoteMap[ticker];
        if (!q?.price) return null;

        let pct = 0;
        if (period === 'today') {
          pct = q.changePercentage ?? q.changesPercentage ?? 0;
        } else if (period === '1w') {
          pct = changeMap[ticker]?.['5D'] ?? changeMap[ticker]?.['1W'] ?? 0;
        } else if (period === '1m') {
          pct = changeMap[ticker]?.['1M'] ?? 0;
        } else if (period === 'ytd') {
          pct = changeMap[ticker]?.['ytd'] ?? changeMap[ticker]?.['YTD'] ?? 0;
        }

        return {
          t: ticker,
          n: q.name || ticker,
          p: (pct >= 0 ? '+' : '') + (+pct).toFixed(2) + '%',
          pctVal: +pct,
          price: parseFloat(q.price.toFixed(2)),
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

    return NextResponse.json(themeResults.sort((a, b) => b.pct - a.pct));
  } catch (err: any) {
    console.error('[scanner/themes]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
