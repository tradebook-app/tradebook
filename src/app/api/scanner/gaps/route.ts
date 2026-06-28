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

function calcADR(high: number, low: number): number {
  if (!high || !low || low === 0) return 0;
  return ((high - low) / ((high + low) / 2)) / 52 * 100;
}

async function fetchQuotes(symbols: string[]) {
  // v3 quote endpoint — available on Starter plan
  const url = `${FMP}/api/v3/quote/${symbols.join(',')}?apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`FMP quote error: ${res.status}`);
  return res.json();
}

async function fetchAftermarket(symbol: string) {
  const url = `${FMP}/api/v4/pre-post-market?symbol=${symbol}&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    // Fetch in batches of 20
    const BATCH = 20;
    const allQuotes: any[] = [];
    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const batch = UNIVERSE.slice(i, i + BATCH);
      const quotes = await fetchQuotes(batch);
      allQuotes.push(...(Array.isArray(quotes) ? quotes : []));
    }

    const gaps = allQuotes
      .filter(q => q?.price && q?.previousClose)
      .map(q => {
        // FMP v3 quote includes pre/post market fields
        const prePrice  = q.preMarketPrice || q.postMarketPrice || q.price;
        const prevClose = q.previousClose;
        const gapPct    = ((prePrice - prevClose) / Math.abs(prevClose)) * 100;
        const preVol    = q.preMarketVolume || 0;
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
          sector:       null,
          industry:     null,
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
