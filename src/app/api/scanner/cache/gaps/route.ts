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

function parseRange(range: string | null | undefined): { low: number | null; high: number | null } {
  if (!range) return { low: null, high: null };
  const match = range.trim().match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (!match) return { low: null, high: null };
  return { low: parseFloat(match[1]), high: parseFloat(match[2]) };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[cache:gaps] Starting gap scan...');

    const allTickers = await fetchAllTickers();
    if (!allTickers.length) return NextResponse.json({ error: 'Failed to fetch tickers' }, { status: 500 });
    console.log(`[cache:gaps] Universe: ${allTickers.length} tickers`);

    const snapshots = await fetchSnapshots(allTickers);
    console.log(`[cache:gaps] Snapshots: ${snapshots.length}`);

    // Build gaps: today's open vs prior close
    const results: any[] = [];
    for (const snap of snapshots) {
      const ticker    = snap.ticker;
      const open      = snap.dailyBar?.o  || 0;      // today's open
      const prevClose = snap.prevDailyBar?.c || 0;   // prior close
      const price     = snap.dailyBar?.c  || snap.prevDailyBar?.c || 0;
      const high      = snap.dailyBar?.h  || 0;
      const low       = snap.dailyBar?.l  || 0;
      const volume    = snap.dailyBar?.v  || 0;

      // Need both open and prevClose to compute a gap
      if (!open || !prevClose) continue;

      const gapPct = ((open - prevClose) / Math.abs(prevClose)) * 100;

      // Only keep meaningful gaps (>= 0.5% either direction)
      if (Math.abs(gapPct) < 0.5) continue;

      const atrPct = price > 0 && high && low ? ((high - low) / price) * 100 : 0;

      results.push({
        ticker,
        name:       ticker,            // enriched by FMP below
        gap:        parseFloat(gapPct.toFixed(2)),
        open:       parseFloat(open.toFixed(2)),
        price:      parseFloat(price.toFixed(2)),
        prevClose:  parseFloat(prevClose.toFixed(2)),
        preVol:     Math.round(volume / 1000),   // day volume in K (proxy until pre-market feed)
        volume,
        atr:        parseFloat(atrPct.toFixed(2)),
        adr:        0,                 // FMP enrichment
        float:      null,              // FMP enrichment
        avgVol:     snap.prevDailyBar?.v || 0,
        dollarVol:  price && snap.prevDailyBar?.v ? price * snap.prevDailyBar.v : null,
        mktCap:     null,              // FMP enrichment
        sector:     null,              // FMP enrichment
        industry:   null,              // FMP enrichment
      });
    }

    console.log(`[cache:gaps] Gaps found: ${results.length}`);

    // Sort by absolute gap size, take top 300 to enrich (FMP rate limits)
    results.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    const topGaps = results.slice(0, 300);

    // Save base data immediately
    await supabase.from('scanner_cache').upsert({
      id:         'gaps',
      data:       topGaps,
      updated_at: new Date().toISOString(),
    });
    console.log(`[cache:gaps] Saved ${topGaps.length} gaps (base). Enriching...`);

    // Enrich top gaps with FMP fundamentals in background
    enrichGaps(topGaps, supabase).catch(e => console.error('[cache:gaps] enrich error:', e));

    return NextResponse.json({
      success: true,
      count: topGaps.length,
      total_gaps: results.length,
      updated_at: new Date().toISOString(),
      note: 'Gap = today open vs prior close (opening gap). Base saved, FMP enriching in background.'
    });

  } catch (err: any) {
    console.error('[cache:gaps]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function enrichGaps(gaps: any[], supabase: any) {
  const enriched = [...gaps];
  const BATCH = 5;

  for (let i = 0; i < enriched.length; i += BATCH) {
    const batch = enriched.slice(i, i + BATCH);
    await Promise.all(batch.map(async (g, idx) => {
      try {
        const [profileRes, floatRes] = await Promise.all([
          fetch(`${FMP_BASE}/profile?symbol=${g.ticker}&apikey=${FMP_KEY}`, { cache: 'no-store' }),
          fetch(`${FMP_BASE}/shares-float?symbol=${g.ticker}&apikey=${FMP_KEY}`, { cache: 'no-store' }),
        ]);

        if (profileRes.ok) {
          const pd = await profileRes.json();
          const p  = Array.isArray(pd) ? pd[0] : pd;
          if (p) {
            const { low: yearLow, high: yearHigh } = parseRange(p.range);
            enriched[i + idx] = {
              ...enriched[i + idx],
              name:     p.companyName || g.ticker,
              mktCap:   p.marketCap   || null,
              sector:   p.sector      || null,
              industry: p.industry    || null,
              adr: yearHigh && yearLow
                ? parseFloat((((yearHigh - yearLow) / ((yearHigh + yearLow) / 2)) / 52 * 100).toFixed(2))
                : 0,
            };
          }
        }

        if (floatRes.ok) {
          const fd = await floatRes.json();
          const f  = Array.isArray(fd) ? fd[0] : fd;
          const floatShares = f?.floatShares ?? f?.float ?? null;
          if (floatShares) {
            enriched[i + idx] = {
              ...enriched[i + idx],
              float: parseFloat((floatShares / 1e6).toFixed(1)),  // in millions
            };
          }
        }
      } catch (e) { /* skip */ }
    }));

    // Save progress every 100
    if (i % 100 === 0 && i > 0) {
      await supabase.from('scanner_cache').upsert({
        id:         'gaps',
        data:       enriched,
        updated_at: new Date().toISOString(),
      });
      await sleep(300);
    }
  }

  // Final save
  await supabase.from('scanner_cache').upsert({
    id:         'gaps',
    data:       enriched,
    updated_at: new Date().toISOString(),
  });
  console.log(`[cache:gaps] Enrichment complete: ${enriched.length} gaps`);
}
