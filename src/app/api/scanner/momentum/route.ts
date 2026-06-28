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
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`FMP quote error: ${res.status}`);
  return res.json();
}

// Use FMP's stock-price-change endpoint — gives 1M/3M/6M/1Y % directly, real data
async function priceChange(symbol: string) {
  const url = `${FMP}/stable/stock-price-change?symbol=${symbol}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
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

    // Fetch real price changes for each ticker (1M, 3M, 6M)
    const results: any[] = [];
    const BATCH = 8;
    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const batch = UNIVERSE.slice(i, i + BATCH);
      await Promise.all(batch.map(async (ticker) => {
        const q = quoteMap[ticker];
        if (!q?.price) return;
        const chg = await priceChange(ticker);

        // FMP price-change fields: 1M, 3M, 6M (percent values)
        const m1 = chg?.['1M'] ?? 0;
        const m3 = chg?.['3M'] ?? 0;
        const m6 = chg?.['6M'] ?? 0;

        const adr = q.yearHigh && q.yearLow
          ? ((q.yearHigh - q.yearLow) / ((q.yearHigh + q.yearLow) / 2)) / 52 * 100 : 0;
        const atrPct = q.dayHigh && q.dayLow
          ? ((q.dayHigh - q.dayLow) / q.price) * 100 : 0;

        results.push({
          ticker,
          name:     q.name || ticker,
          price:    parseFloat(q.price.toFixed(2)),
          m1:       parseFloat((+m1).toFixed(1)),
          m3:       parseFloat((+m3).toFixed(1)),
          m6:       parseFloat((+m6).toFixed(1)),
          adr:      parseFloat(adr.toFixed(2)),
          atrPct:   parseFloat(atrPct.toFixed(2)),
          d50:      q.priceAvg50  ? parseFloat(q.priceAvg50.toFixed(2))  : null,
          d200:     q.priceAvg200 ? parseFloat(q.priceAvg200.toFixed(2)) : null,
          h52:      q.yearHigh || null,
          l52:      q.yearLow  || null,
          volume:   q.volume || 0,
          avgVol:   q.avgVolume || 0,
          mktCap:   q.marketCap || null,
          sector:   q.sector || null,
          industry: q.industry || null,
        });
      }));
    }

    // RS rank based on real 6M performance
    const allM6 = results.map(r => r.m6);
    const ranked = results
      .map(r => ({ ...r, rs: rank99(r.m6, allM6, true) }))
      .sort((a, b) => b.rs - a.rs);

    return NextResponse.json(ranked);
  } catch (err: any) {
    console.error('[scanner/momentum]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
