import { NextResponse } from 'next/server';

const BASE = 'https://financialmodelingprep.com/stable';
const KEY  = process.env.FMP_API_KEY;

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

async function fetchQuote(symbol: string) {
  const res = await fetch(`${BASE}/quote?symbol=${symbol}&apikey=${KEY}`, { next: { revalidate: 900 } });
  if (!res.ok) return null;
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

async function fetchHistory(symbol: string, limit: number) {
  const res = await fetch(`${BASE}/historical-price-eod/full?symbol=${symbol}&limit=${limit}&apikey=${KEY}`, { next: { revalidate: 900 } });
  if (!res.ok) return [];
  const d = await res.json();
  return Array.isArray(d) ? d : (d?.historical || []);
}

function perf(history: any[], days: number): number {
  if (!history || history.length < 2) return 0;
  const latest = history[0]?.close;
  const past   = history[Math.min(days, history.length - 1)]?.close;
  if (!latest || !past || past === 0) return 0;
  return ((latest - past) / Math.abs(past)) * 100;
}

export async function GET(request: Request) {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';

    const allTickers = [...new Set(Object.values(THEMES).flat())];
    const BATCH = 8;
    const quoteMap: Record<string, any> = {};

    for (let i = 0; i < allTickers.length; i += BATCH) {
      const batch = allTickers.slice(i, i + BATCH);
      await Promise.all(batch.map(async t => {
        const q = await fetchQuote(t);
        if (q) quoteMap[t] = q;
      }));
    }

    const histMap: Record<string, any[]> = {};
    if (period !== 'today') {
      const limit = period === '1w' ? 10 : period === '1m' ? 25 : 260;
      for (let i = 0; i < allTickers.length; i += BATCH) {
        const batch = allTickers.slice(i, i + BATCH);
        await Promise.all(batch.map(async t => {
          histMap[t] = await fetchHistory(t, limit);
        }));
      }
    }

    const themeResults = Object.entries(THEMES).map(([name, tickers]) => {
      const stockData = tickers.map(t => {
        const q = quoteMap[t];
        if (!q?.price) return null;
        let pct = 0;
        if (period === 'today') pct = q.changesPercentage ?? 0;
        else if (period === '1w')  pct = perf(histMap[t] || [], 5);
        else if (period === '1m')  pct = perf(histMap[t] || [], 21);
        else if (period === 'ytd') pct = perf(histMap[t] || [], 252);
        return { t, n: q.name || t, p: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', pctVal: pct, price: parseFloat(q.price.toFixed(2)) };
      }).filter(Boolean) as any[];

      const avgPct = stockData.length ? stockData.reduce((s, d) => s + d.pctVal, 0) / stockData.length : 0;
      return { name, pct: parseFloat(avgPct.toFixed(2)), stocks: stockData.sort((a, b) => b.pctVal - a.pctVal).slice(0, 5), period };
    });

    return NextResponse.json(themeResults.sort((a, b) => b.pct - a.pct));
  } catch (err: any) {
    console.error('[scanner/themes]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
