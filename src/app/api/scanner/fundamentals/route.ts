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

function rank99(value: number, arr: number[], higherBetter = true): number {
  if (!arr.length) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= value);
  const raw = idx === -1 ? sorted.length : idx;
  return Math.max(1, Math.min(99, Math.round(higherBetter ? (raw / sorted.length) * 99 : (1 - raw / sorted.length) * 99)));
}

async function fetchQuote(symbol: string) {
  const res = await fetch(`${BASE}/quote?symbol=${symbol}&apikey=${KEY}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

async function fetchIncome(symbol: string) {
  const res = await fetch(`${BASE}/income-statement?symbol=${symbol}&period=quarter&limit=8&apikey=${KEY}`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
}

export async function GET() {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const results: any[] = [];
    const BATCH = 5;

    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const batch = UNIVERSE.slice(i, i + BATCH);
      await Promise.all(batch.map(async ticker => {
        const [q, income] = await Promise.all([fetchQuote(ticker), fetchIncome(ticker)]);
        if (!q?.price) return;

        const stmts = Array.isArray(income) ? income : [];
        const eps0  = stmts[0]?.eps ?? null;
        const eps1  = stmts[1]?.eps ?? null;
        const eps4  = stmts[4]?.eps ?? null;
        const rev0  = stmts[0]?.revenue ?? null;
        const rev4  = stmts[4]?.revenue ?? null;

        const epsQoQ   = eps0 != null && eps1 != null && eps1 !== 0 ? parseFloat(((eps0 - eps1) / Math.abs(eps1) * 100).toFixed(1)) : null;
        const epsYoY   = eps0 != null && eps4 != null && eps4 !== 0 ? parseFloat(((eps0 - eps4) / Math.abs(eps4) * 100).toFixed(1)) : null;
        const revGrowth = rev0 != null && rev4 != null && rev4 !== 0 ? parseFloat(((rev0 - rev4) / Math.abs(rev4) * 100).toFixed(1)) : null;
        const floatM   = q.sharesOutstanding ? parseFloat((q.sharesOutstanding / 1e6).toFixed(1)) : null;

        results.push({ ticker, name: q.name || ticker, price: parseFloat(q.price.toFixed(2)), epsQoQ, epsYoY, revGrowth, floatM, shortPct: null, sector: q.sector || null, mktCap: q.marketCap || null });
      }));
    }

    const epsArr  = results.map(r => r.epsQoQ).filter((v): v is number => v !== null);
    const epsYArr = results.map(r => r.epsYoY).filter((v): v is number => v !== null);
    const revArr  = results.map(r => r.revGrowth).filter((v): v is number => v !== null);
    const fltArr  = results.map(r => r.floatM).filter((v): v is number => v !== null);

    return NextResponse.json(results.map(r => ({
      ...r,
      epsRank:  r.epsQoQ    != null ? rank99(r.epsQoQ,    epsArr,  true)  : null,
      revRank:  r.revGrowth != null ? rank99(r.revGrowth, revArr,  true)  : null,
      instRank: null,
      floatRank: r.floatM  != null ? rank99(r.floatM,    fltArr,  false) : null,
    })).sort((a, b) => (b.epsRank || 0) - (a.epsRank || 0)));
  } catch (err: any) {
    console.error('[scanner/fundamentals]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
