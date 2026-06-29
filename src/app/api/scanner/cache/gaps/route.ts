import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const FMP_BASE     = 'https://financialmodelingprep.com/stable';
const FMP_KEY      = process.env.FMP_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function isPreMarketWindow(): boolean {
  const now = new Date();
  const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const h = et.getHours();
  const m = et.getMinutes();
  const totalMin = h * 60 + m;
  return totalMin >= 240 && totalMin < 570; // 4:00 AM to 9:30 AM ET
}

// Fetch all active tickers from Polygon
async function fetchAllTickers(): Promise<string[]> {
  const tickers: string[] = [];
  let url = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${POLYGON_KEY}`;
  while (url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) break;
    const data = await res.json();
    if (Array.isArray(data.results)) {
      data.results.forEach((t: any) => {
        const sym = t.ticker;
        if (sym && !sym.includes('.') && !sym.includes('/') && sym.length <= 5) {
          tickers.push(sym);
        }
      });
    }
    url = data.next_url ? `${data.next_url}&apiKey=${POLYGON_KEY}` : '';
  }
  return tickers;
}

// Fetch snapshots in batches — includes pre-market data in prevDay/min
async function fetchSnapshots(symbols: string[]): Promise<any[]> {
  const BATCH = 250;
  const results: any[] = [];
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH).join(',');
    let retries = 3;
    while (retries > 0) {
      const res = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${chunk}&apiKey=${POLYGON_KEY}`,
        { cache: 'no-store' }
      );
      if (res.status === 429) { await sleep(2000); retries--; continue; }
      if (!res.ok) break;
      const data = await res.json();
      if (Array.isArray(data.tickers)) results.push(...data.tickers);
      break;
    }
    if (i % 5000 === 0 && i > 0) await sleep(500);
  }
  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
    const inPreMkt  = isPreMarketWindow();
    console.log(`[cache:gaps] Starting gap scan. Pre-market window: ${inPreMkt}`);

    // Step 1: Tickers
    const allTickers = await fetchAllTickers();
    if (!allTickers.length) return NextResponse.json({ error: 'Failed to fetch tickers' }, { status: 500 });
    console.log(`[cache:gaps] Universe: ${allTickers.length} tickers`);

    // Step 2: Snapshots
    const snapshots = await fetchSnapshots(allTickers);
    console.log(`[cache:gaps] Snapshots: ${snapshots.length}`);

    // Step 3: Build gap data
    // Polygon snapshot: prevDay = previous close, min = current minute bar (includes pre-market)
    // lastTrade = most recent trade (includes pre-market trades during pre-market hours)
    const gapStocks: any[] = [];

    for (const snap of snapshots) {
      const prevClose = snap.prevDay?.c || 0;
      if (!prevClose || prevClose <= 0) continue;

      // Pre-market price: use lastTrade price during pre-market window
      // lastTrade.p is the most recent trade price — during pre-market this is the pre-market price
      const preMarketPrice = snap.lastTrade?.p || null;

      // Only include if we have a real pre-market price during pre-market hours
      if (!inPreMkt || !preMarketPrice || preMarketPrice <= 0) continue;

      const gap     = ((preMarketPrice - prevClose) / prevClose) * 100;
      const absGap  = Math.abs(gap);

      // Filter: only meaningful gaps (>= 1%)
      if (absGap < 1) continue;

      // Pre-market volume from lastQuote or day volume (approximate)
      const preVol = snap.min?.av || 0; // accumulated volume

      gapStocks.push({
        ticker:       snap.ticker,
        name:         snap.ticker,
        gap:          parseFloat(gap.toFixed(2)),
        prePrice:     parseFloat(preMarketPrice.toFixed(2)),
        preVol:       Math.round(preVol / 1000), // convert to K
        prevClose:    parseFloat(prevClose.toFixed(2)),
        float:        null, // FMP enrichment
        adr:          0,    // FMP enrichment
        atr:          0,
        avgVol:       snap.prevDay?.v || null,
        mktCap:       null, // FMP enrichment
        dollarVol:    null,
        sector:       null, // FMP enrichment
        industry:     null, // FMP enrichment
        isPreMarket:  true,
        isPostMarket: false,
        updatedAt:    new Date().toISOString(),
      });
    }

    // Sort by absolute gap descending
    gapStocks.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    console.log(`[cache:gaps] Found ${gapStocks.length} gapping stocks`);

    // Step 4: Save immediately
    const { error } = await supabase
      .from('scanner_cache')
      .upsert({ id: 'gaps', data: gapStocks, updated_at: new Date().toISOString() });

    if (error) {
      console.error('[cache:gaps] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Step 5: FMP enrichment in background
    if (gapStocks.length > 0) {
      enrichGapsWithFMP(gapStocks, supabase).catch(e => console.error('[cache:gaps] FMP error:', e));
    }

    return NextResponse.json({
      success:      true,
      count:        gapStocks.length,
      isPreMarket:  inPreMkt,
      updated_at:   new Date().toISOString(),
      note:         'Gap data saved. FMP enrichment running in background.',
    });

  } catch (err: any) {
    console.error('[cache:gaps]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parseRange(range: string | null | undefined): { low: number | null; high: number | null } {
  if (!range) return { low: null, high: null };
  const match = range.trim().match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (!match) return { low: null, high: null };
  return { low: parseFloat(match[1]), high: parseFloat(match[2]) };
}

async function enrichGapsWithFMP(stocks: any[], supabase: any) {
  console.log('[cache:gaps:fmp] Enriching gap stocks with FMP...');
  const BATCH    = 5;
  const enriched = [...stocks];

  for (let i = 0; i < enriched.length; i += BATCH) {
    const batch = enriched.slice(i, i + BATCH);
    await Promise.all(batch.map(async (stock, idx) => {
      try {
        const [profileRes, floatRes] = await Promise.all([
          fetch(`${FMP_BASE}/profile?symbol=${stock.ticker}&apikey=${FMP_KEY}`, { cache: 'no-store' }),
          fetch(`${FMP_BASE}/shares-float?symbol=${stock.ticker}&apikey=${FMP_KEY}`, { cache: 'no-store' }),
        ]);

        if (profileRes.ok) {
          const pd = await profileRes.json();
          const p  = Array.isArray(pd) ? pd[0] : pd;
          if (p) {
            const { low: yearLow, high: yearHigh } = parseRange(p.range);
            enriched[i + idx] = {
              ...enriched[i + idx],
              name:      p.companyName || stock.ticker,
              mktCap:    p.marketCap   || null,
              sector:    p.sector      || null,
              industry:  p.industry    || null,
              adr:       yearHigh && yearLow
                ? parseFloat((((yearHigh - yearLow) / ((yearHigh + yearLow) / 2)) / 52 * 100).toFixed(2))
                : 0,
              dollarVol: p.volAvg && p.price ? parseFloat((p.volAvg * p.price).toFixed(0)) : null,
            };
          }
        }

        if (floatRes.ok) {
          const fd = await floatRes.json();
          const f  = Array.isArray(fd) ? fd[0] : fd;
          if (f?.floatShares) {
            enriched[i + idx] = {
              ...enriched[i + idx],
              float: parseFloat((f.floatShares / 1_000_000).toFixed(2)), // in millions
            };
          }
        }
      } catch (e) {
        // skip
      }
    }));

    if (i % 200 === 0 && i > 0) await sleep(500);
  }

  await supabase.from('scanner_cache').upsert({
    id: 'gaps', data: enriched, updated_at: new Date().toISOString(),
  });
  console.log(`[cache:gaps:fmp] Enrichment complete! ${enriched.length} gap stocks.`);
}
