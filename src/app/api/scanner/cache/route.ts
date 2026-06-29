import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALPACA_KEY    = process.env.ALPACA_API_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
const FMP_BASE      = 'https://financialmodelingprep.com/stable';
const FMP_KEY       = process.env.FMP_API_KEY;
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ALPACA_HEADERS = () => ({
  'APCA-API-KEY-ID':     ALPACA_KEY!,
  'APCA-API-SECRET-KEY': ALPACA_SECRET!,
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchAllTickers(): Promise<string[]> {
  const res = await fetch(
    'https://paper-api.alpaca.markets/v2/assets?status=active&asset_class=us_equity',
    { headers: ALPACA_HEADERS(), cache: 'no-store' }
  );
  if (!res.ok) return [];
  const assets = await res.json();
  return Array.isArray(assets)
    ? assets
        .filter((a: any) =>
          a.tradable &&
          !a.symbol.includes('.') &&
          !a.symbol.includes('/') &&
          a.symbol.length <= 5
        )
        .map((a: any) => a.symbol)
    : [];
}

async function fetchSnapshots(symbols: string[]): Promise<any[]> {
  const BATCH   = 100;
  const results: any[] = [];
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH).join(',');
    let retries = 3;
    while (retries > 0) {
      const res = await fetch(
        `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${chunk}&feed=iex`,
        { headers: ALPACA_HEADERS(), cache: 'no-store' }
      );
      if (res.status === 429) { await sleep(2000); retries--; continue; }
      if (!res.ok) break;
      const data = await res.json();
      Object.entries(data).forEach(([ticker, snap]: [string, any]) => {
        results.push({ ticker, ...snap });
      });
      break;
    }
    if (i % 1000 === 0 && i > 0) await sleep(300);
  }
  return results;
}

// Fetch multi-timeframe bars for ALL symbols in one batch call
async function fetchBarsMulti(symbols: string[], days: number): Promise<Record<string, any[]>> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split('T')[0];
  const BATCH   = 100;
  const result: Record<string, any[]> = {};

  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH).join(',');
    let retries = 3;
    while (retries > 0) {
      const res = await fetch(
        `https://data.alpaca.markets/v2/stocks/bars?symbols=${chunk}&timeframe=1Day&start=${fromStr}&limit=200&feed=iex&sort=desc`,
        { headers: ALPACA_HEADERS(), cache: 'no-store' }
      );
      if (res.status === 429) { await sleep(2000); retries--; continue; }
      if (!res.ok) break;
      const data = await res.json();
      if (data.bars) {
        Object.entries(data.bars).forEach(([ticker, bars]: [string, any]) => {
          result[ticker] = bars;
        });
      }
      break;
    }
    if (i % 500 === 0 && i > 0) await sleep(300);
  }
  return result;
}

function parseRange(range: string | null | undefined): { low: number | null; high: number | null } {
  if (!range) return { low: null, high: null };
  const match = range.trim().match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (!match) return { low: null, high: null };
  return { low: parseFloat(match[1]), high: parseFloat(match[2]) };
}

function rank99(value: number, arr: number[], higherBetter = true): number {
  if (!arr.length) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= value);
  const raw = idx === -1 ? sorted.length : idx;
  return Math.max(1, Math.min(99, Math.round(higherBetter
    ? (raw / sorted.length) * 99
    : (1 - raw / sorted.length) * 99)));
}

function perf(bars: any[], days: number): number {
  if (!bars || bars.length < 2) return 0;
  const latest = bars[0]?.c;
  const past   = bars[Math.min(days, bars.length - 1)]?.c;
  if (!latest || !past || past === 0) return 0;
  return ((latest - past) / Math.abs(past)) * 100;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[cache] Starting full market scan...');

    // Step 1: Tickers
    const allTickers = await fetchAllTickers();
    if (!allTickers.length) return NextResponse.json({ error: 'Failed to fetch tickers' }, { status: 500 });
    console.log(`[cache] Universe: ${allTickers.length} tickers`);

    // Step 2: Snapshots
    const snapshots = await fetchSnapshots(allTickers);
    console.log(`[cache] Snapshots: ${snapshots.length}`);

    // Step 3: Filter
    const filtered = snapshots.filter(s => {
      const price  = s.dailyBar?.c || s.prevDailyBar?.c || 0;
      const volume = s.dailyBar?.v || 0;
      return price > 0 && volume > 1000;
    });
    console.log(`[cache] After filter: ${filtered.length}`);

    const filteredTickers = filtered.map(s => s.ticker);

    // Step 4: Fetch ALL historical bars in bulk (batches of 100 symbols at once)
    console.log('[cache] Fetching historical bars in bulk...');
    const allBars = await fetchBarsMulti(filteredTickers, 210);
    console.log(`[cache] Got bars for ${Object.keys(allBars).length} stocks`);

    // Step 5: Build results from snapshots + bars (no individual API calls)
    const results: any[] = [];

    for (const snap of filtered) {
      const ticker    = snap.ticker;
      const price     = snap.dailyBar?.c  || snap.prevDailyBar?.c  || 0;
      const open      = snap.dailyBar?.o  || snap.prevDailyBar?.o  || 0;
      const high      = snap.dailyBar?.h  || snap.prevDailyBar?.h  || 0;
      const low       = snap.dailyBar?.l  || snap.prevDailyBar?.l  || 0;
      const volume    = snap.dailyBar?.v  || 0;
      const vwap      = snap.dailyBar?.vw || 0;
      const prevClose = snap.prevDailyBar?.c || 0;
      const changeP   = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

      const bars   = allBars[ticker] || [];
      const m1     = perf(bars, 21);
      const m3     = perf(bars, 63);
      const m6     = perf(bars, 126);
      const atrPct = price > 0 && high && low ? ((high - low) / price) * 100 : 0;

      const closes = bars.map((b: any) => b.c).filter(Boolean);
      const sma    = (n: number) => closes.length >= n
        ? closes.slice(0, n).reduce((a: number, b: number) => a + b, 0) / n : null;

      results.push({
        ticker,
        name:   ticker, // Will be enriched by FMP separately
        price:  parseFloat(price.toFixed(2)),
        change: parseFloat(changeP.toFixed(2)),
        open:   parseFloat(open.toFixed(2)),
        high:   parseFloat(high.toFixed(2)),
        low:    parseFloat(low.toFixed(2)),
        vwap:   parseFloat(vwap.toFixed(2)),
        m1:     parseFloat(m1.toFixed(1)),
        m3:     parseFloat(m3.toFixed(1)),
        m6:     parseFloat(m6.toFixed(1)),
        adr:    0,    // FMP enrichment
        atrPct: parseFloat(atrPct.toFixed(2)),
        d50:    sma(50)  ? parseFloat(sma(50)!.toFixed(2))  : null,
        d200:   sma(200) ? parseFloat(sma(200)!.toFixed(2)) : null,
        h52:    null, // FMP enrichment
        l52:    null, // FMP enrichment
        volume,
        avgVol:   snap.prevDailyBar?.v || 0,
        mktCap:   null, // FMP enrichment
        sector:   null, // FMP enrichment
        industry: null, // FMP enrichment
        epsQoQ:   null, // FMP enrichment
        epsYoY:   null, // FMP enrichment
        revGrowth: null, // FMP enrichment
      });
    }

    // Step 6: Rank by 6M performance
    const allM6 = results.map(r => r.m6);
    const ranked = results.map(r => ({
      ...r,
      rs:      rank99(r.m6, allM6, true),
      epsRank: null,
      revRank: null,
    })).sort((a, b) => b.rs - a.rs);

    // Step 7: Save to Supabase immediately
    const { error } = await supabase
      .from('scanner_cache')
      .upsert({
        id:         'momentum',
        data:       ranked,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[cache] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[cache] Saved ${ranked.length} stocks to Supabase`);

    // Step 8: Now enrich with FMP in background (fire and forget)
    enrichWithFMP(ranked, supabase).catch(e => console.error('[cache] FMP enrichment error:', e));

    return NextResponse.json({
      success: true,
      count: ranked.length,
      updated_at: new Date().toISOString(),
      note: 'Base data saved. FMP enrichment running in background.'
    });

  } catch (err: any) {
    console.error('[cache]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// FMP enrichment runs AFTER we've already responded to the client
async function enrichWithFMP(stocks: any[], supabase: any) {
  console.log('[cache:fmp] Starting FMP enrichment...');
  const BATCH = 5;
  const enriched = [...stocks];

  for (let i = 0; i < enriched.length; i += BATCH) {
    const batch = enriched.slice(i, i + BATCH);

    await Promise.all(batch.map(async (stock, idx) => {
      try {
        const [profileRes, incomeRes] = await Promise.all([
          fetch(`${FMP_BASE}/profile?symbol=${stock.ticker}&apikey=${FMP_KEY}`, { cache: 'no-store' }),
          fetch(`${FMP_BASE}/income-statement?symbol=${stock.ticker}&period=quarter&limit=8&apikey=${FMP_KEY}`, { cache: 'no-store' }),
        ]);

        if (profileRes.ok) {
          const pd = await profileRes.json();
          const p  = Array.isArray(pd) ? pd[0] : pd;
          if (p) {
            const { low: yearLow, high: yearHigh } = parseRange(p.range);
            enriched[i + idx] = {
              ...enriched[i + idx],
              name:     p.companyName || stock.ticker,
              mktCap:   p.marketCap   || null,
              sector:   p.sector      || null,
              industry: p.industry    || null,
              h52:      yearHigh,
              l52:      yearLow,
              adr:      yearHigh && yearLow
                ? parseFloat((((yearHigh - yearLow) / ((yearHigh + yearLow) / 2)) / 52 * 100).toFixed(2))
                : 0,
            };
          }
        }

        if (incomeRes.ok) {
          const stmts = await incomeRes.json();
          if (Array.isArray(stmts) && stmts.length > 0) {
            const eps0  = stmts[0]?.eps ?? null;
            const eps1  = stmts[1]?.eps ?? null;
            const eps4  = stmts[4]?.eps ?? null;
            const rev0  = stmts[0]?.revenue ?? null;
            const rev4  = stmts[4]?.revenue ?? null;
            enriched[i + idx] = {
              ...enriched[i + idx],
              epsQoQ:    eps0 != null && eps1 != null && eps1 !== 0 ? (eps0 - eps1) / Math.abs(eps1) * 100 : null,
              epsYoY:    eps0 != null && eps4 != null && eps4 !== 0 ? (eps0 - eps4) / Math.abs(eps4) * 100 : null,
              revGrowth: rev0 != null && rev4 != null && rev4 !== 0 ? (rev0 - rev4) / Math.abs(rev4) * 100 : null,
            };
          }
        }
      } catch (e) {
        // Skip failed enrichments
      }
    }));

    // Re-rank after every 500 stocks enriched and save progress
    if (i % 500 === 0 && i > 0) {
      const allEps = enriched.map(r => r.epsQoQ).filter((v): v is number => v !== null);
      const allRev = enriched.map(r => r.revGrowth).filter((v): v is number => v !== null);
      const allM6  = enriched.map(r => r.m6);

      const reranked = enriched.map(r => ({
        ...r,
        rs:      rank99(r.m6, allM6, true),
        epsRank: r.epsQoQ    != null ? rank99(r.epsQoQ,    allEps, true) : null,
        revRank: r.revGrowth != null ? rank99(r.revGrowth, allRev, true) : null,
      })).sort((a, b) => b.rs - a.rs);

      await supabase.from('scanner_cache').upsert({
        id:         'momentum',
        data:       reranked,
        updated_at: new Date().toISOString(),
      });
      console.log(`[cache:fmp] Progress saved: ${i}/${enriched.length}`);
      await sleep(500);
    }
  }

  // Final save with all FMP data
  const allEps = enriched.map(r => r.epsQoQ).filter((v): v is number => v !== null);
  const allRev = enriched.map(r => r.revGrowth).filter((v): v is number => v !== null);
  const allM6  = enriched.map(r => r.m6);

  const final = enriched.map(r => ({
    ...r,
    rs:      rank99(r.m6, allM6, true),
    epsRank: r.epsQoQ    != null ? rank99(r.epsQoQ,    allEps, true) : null,
    revRank: r.revGrowth != null ? rank99(r.revGrowth, allRev, true) : null,
  })).sort((a, b) => b.rs - a.rs);

  await supabase.from('scanner_cache').upsert({
    id:         'momentum',
    data:       final,
    updated_at: new Date().toISOString(),
  });

  console.log(`[cache:fmp] FMP enrichment complete! ${final.length} stocks fully enriched.`);
}
