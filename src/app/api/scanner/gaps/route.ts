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

// Fetch regular batch quote (price, prevClose, volume, dayHigh/Low, yearHigh/Low, marketCap, sharesOutstanding)
async function batchQuote(symbols: string[]) {
  const url = `${FMP}/stable/batch-quote?symbols=${symbols.join(',')}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`FMP quote error: ${res.status}`);
  return res.json();
}

// Fetch aftermarket / pre-market quote (bid/ask/price + volume outside RTH)
async function batchAftermarket(symbols: string[]) {
  const url = `${FMP}/stable/batch-aftermarket-quote?symbols=${symbols.join(',')}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return []; // aftermarket may be empty during RTH — not fatal
  return res.json();
}

function calcADR(high: number, low: number): number {
  if (!high || !low || low === 0) return 0;
  return ((high - low) / ((high + low) / 2)) / 52 * 100;
}

export async function GET() {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const [quotes, after] = await Promise.all([
      batchQuote(UNIVERSE),
      batchAftermarket(UNIVERSE),
    ]);

    // Map aftermarket prices by symbol
    const afterMap: Record<string, any> = {};
    for (const a of (after || [])) afterMap[a.symbol] = a;

    const gaps = (quotes || [])
      .filter((q: any) => q?.price && q?.previousClose)
      .map((q: any) => {
        const after = afterMap[q.symbol];
        // Pre/after-market price if available, else regular price
        const prePrice  = after?.price || q.price;
        const prevClose = q.previousClose;
        const gapPct    = ((prePrice - prevClose) / Math.abs(prevClose)) * 100;
        const preVol    = after?.volume || q.volume || 0;
        const adr       = calcADR(q.yearHigh, q.yearLow);
        const atrPct    = q.dayHigh && q.dayLow && q.price
          ? ((q.dayHigh - q.dayLow) / q.price) * 100 : 0;
        const floatM    = q.sharesOutstanding ? q.sharesOutstanding / 1e6 : null;

        return {
          ticker:       q.symbol,
          name:         q.name || q.symbol,
          gap:          parseFloat(gapPct.toFixed(2)),
          prePrice:     parseFloat(prePrice.toFixed(2)),
          preVol:       Math.round(preVol / 1000),
          prevClose:    parseFloat(prevClose.toFixed(2)),
          float:        floatM ? parseFloat(floatM.toFixed(1)) : null,
          adr:          parseFloat(adr.toFixed(2)),
          atr:          parseFloat(atrPct.toFixed(2)),
          mktCap:       q.marketCap || null,
          sector:       q.sector || null,
          industry:     q.industry || null,
          isPreMarket:  !!after,
          isPostMarket: false,
          lastUpdated:  new Date().toISOString(),
        };
      })
      .filter((q: any) => Math.abs(q.gap) >= 0.5)
      .sort((a: any, b: any) => Math.abs(b.gap) - Math.abs(a.gap));

    return NextResponse.json(gaps);
  } catch (err: any) {
    console.error('[scanner/gaps]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
