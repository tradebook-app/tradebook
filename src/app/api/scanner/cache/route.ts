import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { THEME_ETF_MAP, assignTheme } from '@/lib/themes';

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const FMP_BASE     = 'https://financialmodelingprep.com/stable';
const FMP_KEY      = process.env.FMP_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

async function fetchBarsMulti(symbols: string[], days: number): Promise<Record<string, any[]>> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split('T')[0];
  const toStr   = new Date().toISOString().split('T')[0];
  const result: Record<string, any[]> = {};
  const CONCURRENCY = 20;

  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const chunk = symbols.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (ticker) => {
      let retries = 3;
      while (retries > 0) {
        const res = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=desc&limit=210&apiKey=${POLYGON_KEY}`,
          { cache: 'no-store' }
        );
        if (res.status === 429) { await sleep(2000); retries--; continue; }
        if (!res.ok) break;
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          result[ticker] = data.results.map((b: any) => ({ c: b.c, h: b.h, l: b.l, o: b.o, v: b.v, vw: b.vw }));
        }
        break;
      }
    }));
    if (i % 1000 === 0 && i > 0) await sleep(300);
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
    console.log('[cache] Starting full market scan with Polygon...');

    const allTickers = await fetchAllTickers();
    if (!allTickers.length) return NextResponse.json({ error: 'Failed to fetch tickers' }, { status: 500 });
    console.log(`[cache] Universe: ${allTickers.length} tickers`);

    const snapshots = await fetchSnapshots(allTickers);
    console.log(`[cache] Snapshots: ${snapshots.length}`);

    const filtered = snapshots.filter(s => {
      const price  = s.day?.c || s.prevDay?.c || 0;
      const volume = s.day?.v || 0;
      return price > 0 && volume > 1000;
    });
    console.log(`[cache] After filter: ${filtered.length}`);

    const filteredTickers = filtered.map(s => s.ticker);

    console.log('[cache] Fetching historical bars...');
    const allBars = await fetchBarsMulti(filteredTickers, 210);
    console.log(`[cache] Got bars for ${Object.keys(allBars).length} stocks`);

    const results: any[] = [];

    for (const snap of filtered) {
      const ticker    = snap.ticker;
      const price     = snap.day?.c  || snap.prevDay?.c || 0;
      const open      = snap.day?.o  || snap.prevDay?.o || 0;
      const high      = snap.day?.h  || snap.prevDay?.h || 0;
      const low       = snap.day?.l  || snap.prevDay?.l || 0;
      const volume    = snap.day?.v  || 0;
      const vwap      = snap.day?.vw || 0;
      const prevClose = snap.prevDay?.c || 0;
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
        name:        ticker,
        price:       parseFloat(price.toFixed(2)),
        change:      parseFloat(changeP.toFixed(2)),
        open:        parseFloat(open.toFixed(2)),
        high:        parseFloat(high.toFixed(2)),
        low:         parseFloat(low.toFixed(2)),
        vwap:        parseFloat(vwap.toFixed(2)),
        m1:          parseFloat(m1.toFixed(1)),
        m3:          parseFloat(m3.toFixed(1)),
        m6:          parseFloat(m6.toFixed(1)),
        adr:         0,
        atrPct:      parseFloat(atrPct.toFixed(2)),
        d50:         sma(50)  ? parseFloat(sma(50)!.toFixed(2))  : null,
        d200:        sma(200) ? parseFloat(sma(200)!.toFixed(2)) : null,
        h52:         null,
        l52:         null,
        volume,
        avgVol:      snap.prevDay?.v || 0,
        mktCap:      null,
        sector:      null,
        industry:    null,
        theme:       null,
        epsQ0:       null,
        epsQ1:       null,
        epsAnn:      null,
        epsCombined: null,
        revGrowth:   null,
      });
    }

    const allM6 = results.map(r => r.m6);
    const ranked = results.map(r => ({
      ...r,
      rs:      rank99(r.m6, allM6, true),
      epsRank: null,
      revRank: null,
    })).sort((a, b) => b.rs - a.rs);

    const { error } = await supabase
      .from('scanner_cache')
      .upsert({ id: 'momentum', data: ranked, updated_at: new Date().toISOString() });

    if (error) {
      console.error('[cache] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[cache] Saved ${ranked.length} stocks to Supabase`);
    enrichWithFMP(ranked, supabase).catch(e => console.error('[cache] FMP enrichment error:', e));

    return NextResponse.json({
      success:    true,
      count:      ranked.length,
      updated_at: new Date().toISOString(),
      note:       'Base data saved. FMP enrichment running in background.',
    });

  } catch (err: any) {
    console.error('[cache]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function enrichWithFMP(stocks: any[], supabase: any) {
  console.log('[cache:fmp] Starting FMP enrichment...');
  const BATCH    = 5;
  const enriched = [...stocks];

  for (let i = 0; i < enriched.length; i += BATCH) {
    const batch = enriched.slice(i, i + BATCH);

    await Promise.all(batch.map(async (stock, idx) => {
      try {
        const [profileRes, incomeRes, annualRes] = await Promise.all([
          fetch(`${FMP_BASE}/profile?symbol=${stock.ticker}&apikey=${FMP_KEY}`, { cache: 'no-store' }),
          fetch(`${FMP_BASE}/income-statement?symbol=${stock.ticker}&period=quarter&limit=8&apikey=${FMP_KEY}`, { cache: 'no-store' }),
          fetch(`${FMP_BASE}/income-statement?symbol=${stock.ticker}&period=annual&limit=2&apikey=${FMP_KEY}`, { cache: 'no-store' }),
        ]);

        if (profileRes.ok) {
          const pd = await profileRes.json();
          const p  = Array.isArray(pd) ? pd[0] : pd;
          if (p) {
            const { low: yearLow, high: yearHigh } = parseRange(p.range);
            const sector   = p.sector   || null;
            const industry = p.industry || null;
            enriched[i + idx] = {
              ...enriched[i + idx],
              name:     p.companyName || stock.ticker,
              mktCap:   p.marketCap   || null,
              sector,
              industry,
              theme:    assignTheme(sector, industry),
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
          if (Array.isArray(stmts) && stmts.length >= 5) {
            const eps0 = stmts[0]?.eps ?? null;
            const eps1 = stmts[1]?.eps ?? null;
            const eps4 = stmts[4]?.eps ?? null;
            const eps5 = stmts[5]?.eps ?? null;
            const rev0 = stmts[0]?.revenue ?? null;
            const rev4 = stmts[4]?.revenue ?? null;

            const epsQ0 = eps0 != null && eps4 != null && eps4 !== 0
              ? parseFloat(((eps0 - eps4) / Math.abs(eps4) * 100).toFixed(2)) : null;
            const epsQ1 = eps1 != null && eps5 != null && eps5 !== 0
              ? parseFloat(((eps1 - eps5) / Math.abs(eps5) * 100).toFixed(2)) : null;

            let epsAnn: number | null = null;
            if (annualRes.ok) {
              const annual = await annualRes.json();
              if (Array.isArray(annual) && annual.length >= 2) {
                const ann0 = annual[0]?.eps ?? null;
                const ann1 = annual[1]?.eps ?? null;
                epsAnn = ann0 != null && ann1 != null && ann1 !== 0
                  ? parseFloat(((ann0 - ann1) / Math.abs(ann1) * 100).toFixed(2)) : null;
              }
            }

            const epsComponents = [epsQ0, epsQ1, epsAnn].filter((v): v is number => v !== null);
            const epsCombined   = epsComponents.length > 0
              ? parseFloat((epsComponents.reduce((a, b) => a + b, 0) / epsComponents.length).toFixed(2))
              : null;

            const revGrowth = rev0 != null && rev4 != null && rev4 !== 0
              ? parseFloat(((rev0 - rev4) / Math.abs(rev4) * 100).toFixed(2)) : null;

            enriched[i + idx] = {
              ...enriched[i + idx],
              epsQ0, epsQ1, epsAnn, epsCombined, revGrowth,
            };
          }
        }
      } catch (e) {
        // skip
      }
    }));

    if (i % 500 === 0 && i > 0) {
      await saveRanked(enriched, supabase);
      console.log(`[cache:fmp] Progress saved: ${i}/${enriched.length}`);
      await sleep(500);
    }
  }

  await saveRanked(enriched, supabase);
  console.log(`[cache:fmp] Complete! ${enriched.length} stocks enriched.`);
}

async function saveRanked(enriched: any[], supabase: any) {
  const allEps = enriched.map(r => r.epsCombined).filter((v): v is number => v !== null);
  const allRev = enriched.map(r => r.revGrowth).filter((v): v is number => v !== null);
  const allM6  = enriched.map(r => r.m6);

  const reranked = enriched.map(r => ({
    ...r,
    rs:      rank99(r.m6,          allM6,   true),
    epsRank: r.epsCombined != null ? rank99(r.epsCombined, allEps, true) : null,
    revRank: r.revGrowth   != null ? rank99(r.revGrowth,   allRev, true) : null,
  })).sort((a, b) => b.rs - a.rs);

  await supabase.from('scanner_cache').upsert({
    id: 'momentum', data: reranked, updated_at: new Date().toISOString(),
  });
}
