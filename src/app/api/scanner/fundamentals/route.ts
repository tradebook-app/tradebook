import { NextResponse } from 'next/server';

const FMP = 'https://financialmodelingprep.com';
const KEY = process.env.FMP_API_KEY;

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

async function batchQuote(symbols: string[]) {
  const url = `${FMP}/stable/batch-quote?symbols=${symbols.join(',')}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  return res.json();
}

// Income statement growth (EPS QoQ / YoY, revenue growth)
async function incomeGrowth(symbol: string) {
  const url = `${FMP}/stable/income-statement-growth?symbol=${symbol}&limit=5&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

// Key metrics / ratios (for float, short interest via separate endpoint)
async function sharesFloat(symbol: string) {
  const url = `${FMP}/stable/shares-float?symbol=${symbol}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function GET() {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const quotes = await batchQuote(UNIVERSE);
    const quoteMap: Record<string, any> = {};
    for (const q of (quotes || [])) quoteMap[q.symbol] = q;

    const results: any[] = [];
    const BATCH = 6;

    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const batch = UNIVERSE.slice(i, i + BATCH);
      await Promise.all(batch.map(async (ticker) => {
        const q = quoteMap[ticker];
        if (!q?.price) return;

        const [growth, float] = await Promise.all([
          incomeGrowth(ticker),
          sharesFloat(ticker),
        ]);

        const g = Array.isArray(growth) ? growth : [];
        // Most recent quarter growth
        const epsQoQ = g[0]?.growthEPS != null ? parseFloat((g[0].growthEPS * 100).toFixed(1)) : null;
        // Year-over-year: compare to 4 quarters ago if available
        const epsYoY = g[3]?.growthEPS != null
          ? parseFloat((((g[0]?.eps ?? 0) - (g[3]?.eps ?? 0)) / Math.abs(g[3]?.eps || 1) * 100).toFixed(1))
          : (g[0]?.growthEPS != null ? parseFloat((g[0].growthEPS * 100).toFixed(1)) : null);
        const revGrowth = g[0]?.growthRevenue != null ? parseFloat((g[0].growthRevenue * 100).toFixed(1)) : null;

        const floatM = float?.floatShares ? parseFloat((float.floatShares / 1e6).toFixed(1))
          : (q.sharesOutstanding ? parseFloat((q.sharesOutstanding / 1e6).toFixed(1)) : null);

        results.push({
          ticker,
          name:     q.name || ticker,
          price:    parseFloat(q.price.toFixed(2)),
          epsQoQ,
          epsYoY,
          revGrowth,
          floatM,
          shortPct: null, // FMP short interest needs separate premium endpoint; left null for now
          instOwn:  null,
          sector:   q.sector || null,
          industry: q.industry || null,
          mktCap:   q.marketCap || null,
        });
      }));
    }

    const epsQoQArr = results.map(r => r.epsQoQ).filter((v): v is number => v !== null);
    const epsYoYArr = results.map(r => r.epsYoY).filter((v): v is number => v !== null);
    const revArr    = results.map(r => r.revGrowth).filter((v): v is number => v !== null);
    const floatArr  = results.map(r => r.floatM).filter((v): v is number => v !== null);

    const ranked = results
      .map(r => ({
        ...r,
        epsRank:  r.epsQoQ    != null ? rank99(r.epsQoQ,    epsQoQArr, true)  : null,
        revRank:  r.revGrowth != null ? rank99(r.revGrowth, revArr,    true)  : null,
        instRank: null,
        floatRank: r.floatM   != null ? rank99(r.floatM,    floatArr,  false) : null,
      }))
      .sort((a, b) => (b.epsRank || 0) - (a.epsRank || 0));

    return NextResponse.json(ranked);
  } catch (err: any) {
    console.error('[scanner/fundamentals]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
