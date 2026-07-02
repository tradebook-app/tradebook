import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { THEME_ETF_MAP, assignTheme } from '@/lib/themes';

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const FMP_BASE     = 'https://financialmodelingprep.com/stable';
const FMP_KEY      = process.env.FMP_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchAllTickers(): Promise<{ ticker: string; type: string }[]> {
  const tickers: { ticker: string; type: string }[] = [];
  let url = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${POLYGON_KEY}`;
  while (url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) break;
    const data = await res.json();
    if (Array.isArray(data.results)) {
      data.results.forEach((t: any) => {
        const sym = t.ticker;
        if (sym && !sym.includes('.') && !sym.includes('/') && sym.length <= 5) {
          tickers.push({ ticker: sym, type: t.type || 'CS' });
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
          result[ticker] = data.results.map((b: any) => ({ c: b.c, h: b.h, l: b.l, o: b.o, v: b.v, vw: b.vw, t: b.t }));
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

// Detects the real start of liquid trading within a bar history. Protects
// against ticker-reuse cases: a symbol can have months of technically-real
// bars that are actually a thinly-traded placeholder (e.g. SPCX traded at
// ~$22 on volumes of 40-200 shares/day for months), followed by a massive
// volume + price discontinuity when the real company actually starts
// trading (SpaceX's uplisting: volume jumped to 500M+ shares and price
// gapped from ~$22 to ~$150 in a single day). Comparing today's price to
// pre-discontinuity noise produces a fabricated "+600% in 3 months" reading.
// Returns the timestamp of the real listing start, or the oldest bar's
// timestamp if no discontinuity is found.
function findRealListingStart(bars: any[]): number {
  if (!bars || bars.length < 6) return bars?.[bars.length - 1]?.t ?? 0;
  const chron = [...bars].reverse(); // oldest -> newest

  // Compare each bar against a rolling MEDIAN baseline of prior bars, not
  // just the immediately preceding bar. A real listing/uplisting event can
  // unfold over 2-3 sessions (partial "when-issued" volume, then full
  // liquidity) — a pure adjacent-pair comparison can miss it if neither
  // single day-over-day hop alone crosses both thresholds, even though the
  // cumulative move against the pre-listing baseline clearly does.
  for (let idx = 5; idx < chron.length; idx++) {
    const cur = chron[idx];
    if (!cur?.c || !cur?.v || !cur?.t) continue;

    const priorWindow = chron.slice(Math.max(0, idx - 60), idx).filter(b => b?.c && b?.v);
    if (priorWindow.length < 5) continue;

    const priorVolumes = [...priorWindow.map(b => b.v)].sort((a, b) => a - b);
    const priorCloses  = [...priorWindow.map(b => b.c)].sort((a, b) => a - b);
    const medianVol    = priorVolumes[Math.floor(priorVolumes.length / 2)];
    const medianClose  = priorCloses[Math.floor(priorCloses.length / 2)];

    const volRatio   = medianVol > 0 ? cur.v / medianVol : (cur.v > 0 ? Infinity : 0);
    const priceRatio = medianClose > 0 ? Math.abs(cur.c - medianClose) / medianClose : 0;

    // Real listing/relisting event: volume spikes 20x+ the recent baseline
    // to a genuinely liquid level, AND price has moved 50%+ from the recent
    // baseline. Both together avoid false positives from ordinary volatile
    // trading days on stocks that were already liquid.
    if (volRatio >= 20 && cur.v >= 1_000_000 && priceRatio >= 0.5) {
      return cur.t;
    }
  }
  return chron[0]?.t ?? 0;
}

// Calendar-date-based performance — matches TradingView's methodology:
// compares latest close to the close on the trading day closest to (but not
// after) exactly N calendar months ago, rather than a fixed trading-day count.
// This avoids drift from holidays/weekends causing 1-10%+ mismatches vs TV,
// especially around volatile weeks that a fixed-count offset can miss or hit.
function perfCalendar(bars: any[], monthsBack: number, listingStart?: number): number | null {
  if (!bars || bars.length < 2) return null;
  const latest = bars[0];
  if (!latest?.c || !latest?.t) return null;

  const targetDate = new Date(latest.t);
  targetDate.setMonth(targetDate.getMonth() - monthsBack);
  const targetTime = targetDate.getTime();

  // If our oldest available bar is more recent than the target date, we
  // don't have enough real history to answer this (e.g. a stock that IPO'd
  // 2 weeks ago has no real "3 months ago" price).
  const oldestBar = bars[bars.length - 1];
  if (!oldestBar?.t || oldestBar.t > targetTime) return null;

  // If the target date falls before the real listing start (pre-discontinuity
  // noise), we also don't have a meaningful reference price — even though
  // technically-real bars exist that far back.
  if (listingStart != null && targetTime < listingStart) return null;

  const pastBar = bars.find((b: any) => b.t != null && b.t <= targetTime);
  const past = pastBar?.c;
  if (!past || past === 0) return null;
  return ((latest.c - past) / Math.abs(past)) * 100;
}

// ADR% — matches TradingView's "ADR% - Average Daily Range %" indicator:
// ADR = 100 * (SMA(high/low, Length) - 1), Length = 20
// bars is sorted desc (most recent first), so slice(0, days) = most recent N trading days.
function calcADR(bars: any[], days = 20): number {
  const recent = bars.slice(0, days);
  const ratios = recent
    .filter((b: any) => b.h && b.l && b.l !== 0)
    .map((b: any) => b.h / b.l);
  if (!ratios.length) return 0;
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return parseFloat((100 * (avgRatio - 1)).toFixed(2));
}

// ATR (raw dollar value, e.g. TradingView's "ATR, 14") using Wilder's smoothing (RMA),
// the standard/default method TradingView's ATR indicator uses.
// bars is sorted desc (most recent first) — reverse to oldest-first for the recursive smoothing.
function calcATR(bars: any[], length = 14): number {
  if (!bars || bars.length < length + 1) return 0;
  const chrono = [...bars].reverse(); // oldest -> newest
  const trueRanges: number[] = [];
  for (let i = 1; i < chrono.length; i++) {
    const cur  = chrono[i];
    const prev = chrono[i - 1];
    if (!cur.h || !cur.l || !prev.c) continue;
    const tr = Math.max(
      cur.h - cur.l,
      Math.abs(cur.h - prev.c),
      Math.abs(cur.l - prev.c)
    );
    trueRanges.push(tr);
  }
  if (trueRanges.length < length) return 0;

  // Seed with simple average of the first `length` true ranges, then apply Wilder's RMA.
  let atr = trueRanges.slice(0, length).reduce((a, b) => a + b, 0) / length;
  for (let i = length; i < trueRanges.length; i++) {
    atr = (atr * (length - 1) + trueRanges[i]) / length;
  }
  return parseFloat(atr.toFixed(2));
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
    const tickerTypeMap = new Map(allTickers.map(t => [t.ticker, t.type]));
    const tickerSymbols = allTickers.map(t => t.ticker);

    const snapshots = await fetchSnapshots(tickerSymbols);
    console.log(`[cache] Snapshots: ${snapshots.length}`);

    const filtered = snapshots.filter(s => {
      const price  = s.day?.c || s.prevDay?.c || 0;
      const volume = s.day?.v || s.prevDay?.v || 0;
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
      const listingStart = findRealListingStart(bars);
      const m1     = perfCalendar(bars, 1, listingStart);
      const m3     = perfCalendar(bars, 3, listingStart);
      const m6     = perfCalendar(bars, 6, listingStart);
      if ((m1 != null && Math.abs(m1) > 200) || (m3 != null && Math.abs(m3) > 200) || (m6 != null && Math.abs(m6) > 200)) {
        console.warn(`[cache] Extreme perf for ${ticker}: m1=${m1} m3=${m3} m6=${m6} listingStart=${new Date(listingStart).toISOString()} bars=${bars.length} oldestBar=${bars[bars.length-1] ? new Date(bars[bars.length-1].t).toISOString() : 'n/a'}`);
      }
      // Weighted RS score: 40% 1M + 35% 3M + 25% 6M (favors recent momentum).
      // If any component is null (not enough price history — e.g. a recent
      // IPO), don't fabricate a blended score from partial data.
      const rsScore = (m1 != null && m3 != null && m6 != null)
        ? (m1 * 0.40) + (m3 * 0.35) + (m6 * 0.25)
        : null;
      const atrPct = price > 0 && high && low ? ((high - low) / price) * 100 : 0;
      const adr    = calcADR(bars, 20);
      const atr    = calcATR(bars, 14);

      const closes = bars.map((b: any) => b.c).filter(Boolean);
      const sma    = (n: number) => closes.length >= n
        ? closes.slice(0, n).reduce((a: number, b: number) => a + b, 0) / n : null;

      results.push({
        ticker,
        name:        ticker,
        isEtf:       tickerTypeMap.get(ticker) === 'ETF',
        price:       parseFloat(price.toFixed(2)),
        change:      parseFloat(changeP.toFixed(2)),
        open:        parseFloat(open.toFixed(2)),
        high:        parseFloat(high.toFixed(2)),
        low:         parseFloat(low.toFixed(2)),
        vwap:        parseFloat(vwap.toFixed(2)),
        m1:          m1 != null ? parseFloat(m1.toFixed(1)) : null,
        m3:          m3 != null ? parseFloat(m3.toFixed(1)) : null,
        m6:          m6 != null ? parseFloat(m6.toFixed(1)) : null,
        rsScore:     rsScore != null ? parseFloat(rsScore.toFixed(2)) : null,
        adr,
        atr,
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
        revQ0:       null,
        revQ1:       null,
        revGrowth:   null,
      });
    }

    const allRsScores = results.map(r => r.rsScore).filter((v): v is number => v !== null);
    const ranked = results.map(r => ({
      ...r,
      rs:      r.rsScore != null ? rank99(r.rsScore, allRsScores, true) : 1,
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
            // NOTE: ADR% is intentionally NOT set here. It's computed once from
            // Polygon daily bars in the main cache route (calcADR, TradingView formula)
            // and must not be overwritten with FMP's 52-week range data.
            enriched[i + idx] = {
              ...enriched[i + idx],
              name:     p.companyName || stock.ticker,
              mktCap:   p.marketCap   || null,
              sector,
              industry,
              theme:    assignTheme(sector, industry),
              h52:      yearHigh,
              l52:      yearLow,
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
            const rev1 = stmts[1]?.revenue ?? null;
            const rev4 = stmts[4]?.revenue ?? null;
            const rev5 = stmts[5]?.revenue ?? null;

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

            // Revenue growth, combined: current-quarter YoY + prior-quarter YoY averaged
            // together (same approach as epsCombined), instead of current-quarter-only.
            const revQ0 = rev0 != null && rev4 != null && rev4 !== 0
              ? parseFloat(((rev0 - rev4) / Math.abs(rev4) * 100).toFixed(2)) : null;
            const revQ1 = rev1 != null && rev5 != null && rev5 !== 0
              ? parseFloat(((rev1 - rev5) / Math.abs(rev5) * 100).toFixed(2)) : null;
            const revComponents = [revQ0, revQ1].filter((v): v is number => v !== null);
            const revGrowth = revComponents.length > 0
              ? parseFloat((revComponents.reduce((a, b) => a + b, 0) / revComponents.length).toFixed(2))
              : null;

            enriched[i + idx] = {
              ...enriched[i + idx],
              epsQ0, epsQ1, epsAnn, epsCombined, revQ0, revQ1, revGrowth,
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
  const allEps     = enriched.map(r => r.epsCombined).filter((v): v is number => v !== null);
  const allRev     = enriched.map(r => r.revGrowth).filter((v): v is number => v !== null);
  const allRsScore = enriched.map(r => r.rsScore);

  const reranked = enriched.map(r => ({
    ...r,
    // IMPORTANT: rank by the weighted rsScore (40% 1M + 35% 3M + 25% 6M), NOT raw m6.
    // Previously this fell back to rank99(r.m6, allM6, true), which silently
    // discarded the weighted RS formula every time enrichment ran.
    rs:      rank99(r.rsScore, allRsScore, true),
    epsRank: r.epsCombined != null ? rank99(r.epsCombined, allEps, true) : null,
    revRank: r.revGrowth   != null ? rank99(r.revGrowth,   allRev, true) : null,
  })).sort((a, b) => b.rs - a.rs);

  await supabase.from('scanner_cache').upsert({
    id: 'momentum', data: reranked, updated_at: new Date().toISOString(),
  });
}
