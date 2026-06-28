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
  const res = await fetch(`${BASE}/quote?symbol=${symbol}&apikey=${KEY}`, { next: { revalidate: 1800 } });
  if (!res.ok) return null;
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

async function fetchHistory(symbol: string) {
  const res = await fetch(`${BASE}/historical-price-eod/full?symbol=${symbol}&limit=200&apikey=${KEY}`, { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const d = await res.json();
  return Array.isArray(d) ? d : (d?.historical || []);
}

async function fetchIncome(symbol: string) {
  const res = await fetch(`${BASE}/income-statement?symbol=${symbol}&period=quarter&limit=8&apikey=${KEY}`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
}

async function fetchProfile(symbol: string) {
  const res = await fetch(`${BASE}/profile?symbol=${symbol}&apikey=${KEY}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

function perf(history: any[], days: number): number {
  if (!history || history.length < 2) return 0;
  const latest = history[0]?.close;
  const past   = history[Math.min(days, history.length - 1)]?.close;
  if (!latest || !past || past === 0) return 0;
  return ((latest - past) / Math.abs(past)) * 100;
}

export async function GET() {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const BATCH = 5;
    const results: any[] = [];

    for (let i = 0; i < UNIVERSE.length; i += BATCH) {
      const batch = UNIVERSE.slice(i, i + BATCH);
      await Promise.all(batch.map(async ticker => {
        const [q, history, income, profile] = await Promise.all([
          fetchQuote(ticker),
          fetchHistory(ticker),
          fetchIncome(ticker),
          fetchProfile(ticker),
        ]);
        if (!q?.price) return;

        // Performance from real historical prices
        const m1 = perf(history, 21);
        const m3 = perf(history, 63);
        const m6 = perf(history, 126);

        const adr = q.yearHigh && q.yearLow
          ? ((q.yearHigh - q.yearLow) / ((q.yearHigh + q.yearLow) / 2)) / 52 * 100 : 0;
        const atrPct = q.dayHigh && q.dayLow
          ? ((q.dayHigh - q.dayLow) / q.price) * 100 : 0;

        // EPS growth QoQ
        const stmts = Array.isArray(income) ? income : [];
        const eps0 = stmts[0]?.eps ?? null;
        const eps1 = stmts[1]?.eps ?? null;
        const eps4 = stmts[4]?.eps ?? null;
        const epsQoQ = eps0 != null && eps1 != null && eps1 !== 0
          ? (eps0 - eps1) / Math.abs(eps1) * 100 : null;

        // Revenue growth YoY
        const rev0 = stmts[0]?.revenue ?? null;
        const rev4 = stmts[4]?.revenue ?? null;
        const revGrowth = rev0 != null && rev4 != null && rev4 !== 0
          ? (rev0 - rev4) / Math.abs(rev4) * 100 : null;

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
          sector:   profile?.sector || q.sector || null,
          epsQoQ,
          revGrowth,
        });
      }));
    }

    // Build RS rank from 6M performance
    const allM6  = results.map(r => r.m6);
    const allEps = results.map(r => r.epsQoQ).filter((v): v is number => v !== null);
    const allRev = results.map(r => r.revGrowth).filter((v): v is number => v !== null);

    const ranked = results.map(r => ({
      ...r,
      rs:      rank99(r.m6, allM6, true),
      epsRank: r.epsQoQ    != null ? rank99(r.epsQoQ,    allEps, true) : null,
      revRank: r.revGrowth != null ? rank99(r.revGrowth, allRev, true) : null,
    })).sort((a, b) => b.rs - a.rs);

    return NextResponse.json(ranked);
  } catch (err: any) {
    console.error('[scanner/momentum]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
