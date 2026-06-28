import { NextResponse } from 'next/server';

const BASE = 'https://financialmodelingprep.com/stable';
const KEY  = process.env.FMP_API_KEY;

const UNIVERSE = [
  'NVDA','PLTR','META','GOOGL','AMZN','AAPL','TSM',
  'SMCI','IONQ','SOUN','MSTR','CRWD','PANW','ARM','AI',
  'RGTI','QUBT','CELH','WOLF','COIN','RIOT','MARA',
  'AMD','AVGO','QCOM','MU','NOW','CRM','SNOW','DDOG',
  'NET','LMT','RTX','AXON','MRNA','TSLA','RIVN','MSFT',
];

function calcADR(high: number, low: number): number {
  if (!high || !low || low === 0) return 0;
  return ((high - low) / ((high + low) / 2)) / 52 * 100;
}

async function fetchQuote(symbol: string) {
  const url = `${BASE}/quote?symbol=${symbol}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function GET() {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    // Fetch quotes in parallel batches of 10
    const BATCH = 10;
    const allQuotes: any[] = [];

    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const batch = UNIVERSE.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(fetchQuote));
      allQuotes.push(...results.filter(Boolean));
    }

    const gaps = allQuotes
      .filter(q => q?.price && q?.previousClose)
      .map(q => {
        const prePrice  = q.preMarketPrice || q.postMarketPrice || q.price;
        const prevClose = q.previousClose;
        const gapPct    = ((prePrice - prevClose) / Math.abs(prevClose)) * 100;
        const adr       = calcADR(q.yearHigh, q.yearLow);
        const atrPct    = q.dayHigh && q.dayLow ? ((q.dayHigh - q.dayLow) / q.price) * 100 : 0;
        const floatM    = q.sharesOutstanding ? q.sharesOutstanding / 1e6 : null;

        return {
          ticker:       q.symbol,
          name:         q.name || q.symbol,
          gap:          parseFloat(gapPct.toFixed(2)),
          prePrice:     parseFloat(prePrice.toFixed(2)),
          preVol:       Math.round((q.preMarketVolume || 0) / 1000),
          prevClose:    parseFloat(prevClose.toFixed(2)),
          float:        floatM ? parseFloat(floatM.toFixed(1)) : null,
          adr:          parseFloat(adr.toFixed(2)),
          atr:          parseFloat(atrPct.toFixed(2)),
          mktCap:       q.marketCap || null,
          sector:       q.sector || null,
          industry:     q.industry || null,
          isPreMarket:  !!q.preMarketPrice,
          isPostMarket: !q.preMarketPrice && !!q.postMarketPrice,
          lastUpdated:  new Date().toISOString(),
        };
      })
      .filter(q => Math.abs(q.gap) >= 0.5)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    return NextResponse.json(gaps);
  } catch (err: any) {
    console.error('[scanner/gaps]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
