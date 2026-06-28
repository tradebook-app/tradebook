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
  const res = await fetch(`${BASE}/quote?symbol=${symbol}&apikey=${KEY}`, { next: { revalidate: 120 } });
  if (!res.ok) return null;
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

async function fetchFloat(symbol: string) {
  const res = await fetch(`${BASE}/shares-float?symbol=${symbol}&apikey=${KEY}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

async function fetchProfile(symbol: string) {
  const res = await fetch(`${BASE}/profile?symbol=${symbol}&apikey=${KEY}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

export async function GET() {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const BATCH = 8;
    const results: any[] = [];

    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const batch = UNIVERSE.slice(i, i + BATCH);
      await Promise.all(batch.map(async (symbol) => {
        const [q, floatData, profile] = await Promise.all([
          fetchQuote(symbol),
          fetchFloat(symbol),
          fetchProfile(symbol),
        ]);
        if (!q?.price || !q?.previousClose) return;

        const prePrice  = q.preMarketPrice || q.postMarketPrice || q.price;
        const prevClose = q.previousClose;
        const gapPct    = ((prePrice - prevClose) / Math.abs(prevClose)) * 100;
        const adr       = calcADR(q.yearHigh, q.yearLow);
        const atrPct    = q.dayHigh && q.dayLow ? ((q.dayHigh - q.dayLow) / q.price) * 100 : 0;

        // Float from shares-float endpoint
        const floatShares = floatData?.floatShares ?? floatData?.float ?? null;
        const floatM = floatShares ? parseFloat((floatShares / 1e6).toFixed(1)) : null;

        results.push({
          ticker:       symbol,
          name:         q.name || symbol,
          gap:          parseFloat(gapPct.toFixed(2)),
          prePrice:     parseFloat(prePrice.toFixed(2)),
          preVol:       Math.round((q.preMarketVolume || 0) / 1000),
          prevClose:    parseFloat(prevClose.toFixed(2)),
          float:        floatM,
          adr:          parseFloat(adr.toFixed(2)),
          atr:          parseFloat(atrPct.toFixed(2)),
          mktCap:       q.marketCap || null,
          sector:       profile?.sector || null,
          industry:     profile?.industry || null,
          isPreMarket:  !!q.preMarketPrice,
          isPostMarket: !q.preMarketPrice && !!q.postMarketPrice,
          lastUpdated:  new Date().toISOString(),
        });
      }));
    }

    const gaps = results
      .filter(q => Math.abs(q.gap) >= 0.5)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    return NextResponse.json(gaps);
  } catch (err: any) {
    console.error('[scanner/gaps]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
