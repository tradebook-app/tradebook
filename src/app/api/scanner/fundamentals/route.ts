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
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  return res.json();
}

async function fetchIncomeStatement(symbol: string) {
  // Quarterly income statements — last 8 quarters
  const url = `${FMP}/api/v3/income-statement/${symbol}?period=quarter&limit=8&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
}

async function fetchKeyMetrics(symbol: string) {
  const url = `${FMP}/api/v3/key-metrics/${symbol}?period=quarter&limit=4&apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
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
    const FBATCH = 4;

    for (let i = 0; i < UNIVERSE.length; i += FBATCH) {
      const batch = UNIVERSE.slice(i, i + FBATCH);
      await Promise.all(batch.map(async (ticker) => {
        const q = quoteMap[ticker];
        if (!q?.price) return;

        const [income, metrics] = await Promise.all([
          fetchIncomeStatement(ticker),
          fetchKeyMetrics(ticker),
        ]);

        const stmts = Array.isArray(income) ? income : [];
        const mets  = Array.isArray(metrics) ? metrics : [];

        // EPS QoQ: compare latest quarter EPS to previous quarter
        const eps0 = stmts[0]?.eps ?? null;
        const eps1 = stmts[1]?.eps ?? null;
        const epsQoQ = eps0 != null && eps1 != null && eps1 !== 0
          ? parseFloat(((eps0 - eps1) / Math.abs(eps1) * 100).toFixed(1)) : null;

        // EPS YoY: compare latest quarter EPS to same quarter last year (4 quarters ago)
        const eps4 = stmts[4]?.eps ?? null;
        const epsYoY = eps0 != null && eps4 != null && eps4 !== 0
          ? parseFloat(((eps0 - eps4) / Math.abs(eps4) * 100).toFixed(1)) : null;

        // Revenue growth QoQ
        const rev0 = stmts[0]?.revenue ?? null;
        const rev4 = stmts[4]?.revenue ?? null;
        const revGrowth = rev0 != null && rev4 != null && rev4 !== 0
          ? parseFloat(((rev0 - rev4) / Math.abs(rev4) * 100).toFixed(1)) : null;

        // Float from shares outstanding
        const floatM = q.sharesOutstanding ? parseFloat((q.sharesOutstanding / 1e6).toFixed(1)) : null;

        // Institutional ownership from key metrics
        const instOwn = mets[0]?.investedCapital ?? null;

        results.push({
          ticker,
          name:     q.name || ticker,
          price:    parseFloat(q.price.toFixed(2)),
          epsQoQ,
          epsYoY,
          revGrowth,
          floatM,
          shortPct: null,
          instOwn:  null,
          sector:   null,
          industry: null,
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
        epsRank:   r.epsQoQ    != null ? rank99(r.epsQoQ,    epsQoQArr, true)  : null,
        epsYoYRank: r.epsYoY   != null ? rank99(r.epsYoY,    epsYoYArr, true)  : null,
        revRank:   r.revGrowth != null ? rank99(r.revGrowth, revArr,    true)  : null,
        instRank:  null,
        floatRank: r.floatM    != null ? rank99(r.floatM,    floatArr,  false) : null,
      }))
      .sort((a, b) => (b.epsRank || 0) - (a.epsRank || 0));

    return NextResponse.json(ranked);
  } catch (err: any) {
    console.error('[scanner/fundamentals]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
