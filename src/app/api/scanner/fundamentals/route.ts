import { NextResponse } from 'next/server';

const UNIVERSE = [
  'NVDA','PLTR','MSFT','META','GOOGL','AMZN','AAPL','TSM',
  'SMCI','IONQ','SOUN','MSTR','CRWD','PANW','ARM','AI',
  'RGTI','QUBT','CELH','WOLF','COIN','RIOT','MARA',
  'AMD','AVGO','QCOM','MU','AMAT','NOW','CRM','SNOW','DDOG',
  'NET','ZS','LMT','RTX','AXON','MRNA','CRSP','TSLA','RIVN',
];

function rank99(value: number, arr: number[], higherBetter = true): number {
  if (!arr.length) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= value);
  const raw = idx === -1 ? sorted.length : idx;
  const pct = raw / sorted.length;
  return Math.max(1, Math.min(99, Math.round(higherBetter ? pct * 99 : (1 - pct) * 99)));
}

async function fetchQuoteSummary(ticker: string) {
  // Yahoo Finance v11 quoteSummary for fundamentals
  const modules = 'defaultKeyStatistics,financialData,earningsTrend,price';
  const url = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${ticker}?modules=${modules}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    next: { revalidate: 3600 }, // cache 1 hour
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.quoteSummary?.result?.[0] || null;
}

export async function GET() {
  try {
    const results: any[] = [];

    // Fetch fundamentals for each ticker (sequential to avoid rate limits)
    for (const ticker of UNIVERSE) {
      try {
        const summary = await fetchQuoteSummary(ticker);
        if (!summary) continue;

        const price     = summary.price?.regularMarketPrice?.raw;
        const stats     = summary.defaultKeyStatistics || {};
        const finData   = summary.financialData || {};
        const trend     = summary.earningsTrend?.trend || [];

        if (!price) continue;

        // EPS growth
        const currentTrend = trend.find((t: any) => t.period === '0q');
        const epsQoQ = currentTrend?.growth?.raw != null
          ? parseFloat((currentTrend.growth.raw * 100).toFixed(1))
          : null;

        const annualTrend = trend.find((t: any) => t.period === '0y');
        const epsYoY = annualTrend?.growth?.raw != null
          ? parseFloat((annualTrend.growth.raw * 100).toFixed(1))
          : null;

        // Revenue growth
        const revGrowth = finData.revenueGrowth?.raw != null
          ? parseFloat((finData.revenueGrowth.raw * 100).toFixed(1))
          : null;

        // Float
        const floatM = stats.floatShares?.raw
          ? parseFloat((stats.floatShares.raw / 1e6).toFixed(1))
          : null;

        // Short interest
        const shortPct = stats.shortPercentOfFloat?.raw != null
          ? parseFloat((stats.shortPercentOfFloat.raw * 100).toFixed(1))
          : null;

        // Institutional ownership
        const instOwn = stats.heldPercentInstitutions?.raw != null
          ? parseFloat((stats.heldPercentInstitutions.raw * 100).toFixed(1))
          : null;

        results.push({
          ticker,
          name:     summary.price?.longName || ticker,
          price:    parseFloat(price.toFixed(2)),
          epsQoQ,
          epsYoY,
          revGrowth,
          floatM,
          shortPct,
          instOwn,
          sector:   summary.price?.sector   || null,
          industry: summary.price?.industry || null,
          mktCap:   summary.price?.marketCap?.raw || null,
        });
      } catch {
        // Skip tickers that fail silently
      }
    }

    // Build 1-99 rankings across the universe
    const epsQoQArr = results.map(r => r.epsQoQ).filter((v): v is number => v !== null);
    const epsYoYArr = results.map(r => r.epsYoY).filter((v): v is number => v !== null);
    const revArr    = results.map(r => r.revGrowth).filter((v): v is number => v !== null);
    const instArr   = results.map(r => r.instOwn).filter((v): v is number => v !== null);
    const floatArr  = results.map(r => r.floatM).filter((v): v is number => v !== null);
    const shortArr  = results.map(r => r.shortPct).filter((v): v is number => v !== null);

    const ranked = results
      .map(r => ({
        ...r,
        epsRank:   r.epsQoQ    != null ? rank99(r.epsQoQ,    epsQoQArr, true)  : null,
        epsYoYRank: r.epsYoY   != null ? rank99(r.epsYoY,    epsYoYArr, true)  : null,
        revRank:   r.revGrowth != null ? rank99(r.revGrowth, revArr,    true)  : null,
        instRank:  r.instOwn   != null ? rank99(r.instOwn,   instArr,   true)  : null,
        floatRank: r.floatM    != null ? rank99(r.floatM,    floatArr,  false) : null, // lower = better
        shortRank: r.shortPct  != null ? rank99(r.shortPct,  shortArr,  true)  : null,
      }))
      .sort((a, b) => (b.epsRank || 0) - (a.epsRank || 0));

    return NextResponse.json(ranked);
  } catch (err: any) {
    console.error('[scanner/fundamentals]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
