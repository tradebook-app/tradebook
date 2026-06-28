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

async function fetchQuotes(symbols: string[]) {
  const url = `${FMP}/api/v3/quote/${symbols.join(',')}?apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  return res.json();
}

async function fetchHistory(symbol: string, days: number) {
  const url = `${FMP}/api/v3/historical-price-full/${symbol}?timeseries=${days}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.historical || [];
}

function perfFromHistory(history: any[], daysAgo: number): number {
  if (!history || history.length < 2) return 0;
  const latest = history[0]?.close;
  const past   = history[Math.min(daysAgo, history.length - 1)]?.close;
  if (!latest || !past || past === 0) return 0;
  return ((latest - past) / Math.abs(past)) * 100;
}

export async function GET(request: Request) {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';

    const allTickers = [...new Set(Object.values(THEMES).flat())];
    const BATCH = 20;
    const allQuotes: any[] = [];
    for (let i = 0; i < allTickers.length; i += BATCH) {
      const quotes = await fetchQuotes(allTickers.slice(i, i + BATCH));
      allQuotes.push(...(Array.isArray(quotes) ? quotes : []));
    }
    const quoteMap: Record<string, any> = {};
    for (const q of allQuotes) quoteMap[q.symbol] = q;

    // For non-today periods, fetch history for each ticker
    const histMap: Record<string, any[]> = {};
    if (period !== 'today') {
      const days = period === '1w' ? 10 : period === '1m' ? 25 : 260;
      const HBATCH = 5;
      for (let i = 0; i < allTickers.length; i += HBATCH) {
        const batch = allTickers.slice(i, i + HBATCH);
        await Promise.all(batch.map(async t => {
          histMap[t] = await fetchHistory(t, days);
        }));
      }
    }

    const themeResults = Object.entries(THEMES).map(([themeName, tickers]) => {
      const stockData = tickers.map(ticker => {
        const q = quoteMap[ticker];
        if (!q?.price) return null;

        let pct = 0;
        if (period === 'today') {
          pct = q.changesPercentage ?? 0;
        } else if (period === '1w') {
          pct = perfFromHistory(histMap[ticker] || [], 5);
        } else if (period === '1m') {
          pct = perfFromHistory(histMap[ticker] || [], 21);
        } else if (period === 'ytd') {
          pct = perfFromHistory(histMap[ticker] || [], 252);
        }

        return {
          t: ticker,
          n: q.name || ticker,
          p: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
          pctVal: pct,
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
