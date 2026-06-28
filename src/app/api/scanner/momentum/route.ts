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

async function fetchQuotes(symbols: string[]) {
  const url = `${FMP}/api/v3/quote/${symbols.join(',')}?apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  return res.json();
}

async function fetchHistory(symbol: string) {
  // Get last 200 days of daily prices for accurate 1M/3M/6M calculation
  const url = `${FMP}/api/v3/historical-price-full/${symbol}?timeseries=200&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) return null;
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

export async function GET() {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const BATCH = 20;
    const allQuotes: any[] = [];
    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const quotes = await fetchQuotes(UNIVERSE.slice(i, i + BATCH));
      allQuotes.push(...(Array.isArray(quotes) ? quotes : []));
    }
    const quoteMap: Record<string, any> = {};
    for (const q of allQuotes) quoteMap[q.symbol] = q;

    const results: any[] = [];
    const HIST_BATCH = 5;
    for (let i = 0; i < UNIVERSE.length; i += HIST_BATCH) {
      const batch = UNIVERSE.slice(i, i + HIST_BATCH);
      await Promise.all(batch.map(async (ticker) => {
        const q = quoteMap[ticker];
        if (!q?.price) return;

        const history = await fetchHistory(ticker);

        // Real performance from actual historical prices
        const m1 = perfFromHistory(history, 21);   // ~1 month
        const m3 = perfFromHistory(history, 63);   // ~3 months
        const m6 = perfFromHistory(history, 126);  // ~6 months

        const adr = q.yearHigh && q.yearLow
          ? ((q.yearHigh - q.yearLow) / ((q.yearHigh + q.yearLow) / 2)) / 52 * 100 : 0;
        const atrPct = q.dayHigh && q.dayLow
          ? ((q.dayHigh - q.dayLow) / q.price) * 100 : 0;

        results.push({
          ticker,
          name:     q.name || ticker,
          price:    parseFloat(q.price.toFixed(2)),
          m1:       parseFloat(m1.toFixed(1)),
          m3:       parseFloat(m3.toFixed(1)),
          m6:       parseFloat(m6.toFixed(1)),
          adr:      parseFloat(adr.toFixed(2)),
          atrPct:   parseFloat(atrPct.toFixed(2)),
          d50:      q.priceAvg50  ? parseFloat(q.priceAvg50.toFixed(2))  : null,
          d200:     q.priceAvg200 ? parseFloat(q.priceAvg200.toFixed(2)) : null,
          h52:      q.yearHigh || null,
          l52:      q.yearLow  || null,
          volume:   q.volume || 0,
          avgVol:   q.avgVolume || 0,
          mktCap:   q.marketCap || null,
          sector:   null,
          industry: null,
        });
      }));
    }

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
