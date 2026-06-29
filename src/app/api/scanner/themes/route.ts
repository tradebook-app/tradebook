import { NextResponse } from 'next/server';
import { THEME_ETF_MAP } from '@/lib/themes';

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Fetch historical bars for an ETF
async function fetchBars(ticker: string, days: number): Promise<any[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split('T')[0];
  const toStr   = new Date().toISOString().split('T')[0];

  const res = await fetch(
    `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=desc&limit=${days + 10}&apiKey=${POLYGON_KEY}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

function perfFromBars(bars: any[], days: number): number | null {
  if (!bars || bars.length < 2) return null;
  const latest = bars[0]?.c;
  const past   = bars[Math.min(days, bars.length - 1)]?.c;
  if (!latest || !past || past === 0) return null;
  return parseFloat((((latest - past) / Math.abs(past)) * 100).toFixed(2));
}

// Get today's change from snapshot
async function fetchSnapshot(ticker: string): Promise<{ price: number; change1d: number } | null> {
  const res = await fetch(
    `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const snap = data.ticker;
  if (!snap) return null;
  const price     = snap.day?.c || snap.prevDay?.c || 0;
  const prevClose = snap.prevDay?.c || 0;
  const change1d  = prevClose > 0 ? parseFloat((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;
  return { price, change1d };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'today';

  try {
    // Fetch all ETF data concurrently in batches of 10
    const CONCURRENCY = 10;
    const results: any[] = [];

    const themes = THEME_ETF_MAP;

    for (let i = 0; i < themes.length; i += CONCURRENCY) {
      const chunk = themes.slice(i, i + CONCURRENCY);

      const chunkResults = await Promise.all(chunk.map(async (t) => {
        try {
          const [snap, bars] = await Promise.all([
            fetchSnapshot(t.etf),
            fetchBars(t.etf, 260), // enough for YTD + 6M
          ]);

          if (!snap && !bars.length) return null;

          const price    = snap?.price || bars[0]?.c || 0;
          const change1d = snap?.change1d || 0;

          // Calculate performance for each period
          const pct1w  = perfFromBars(bars, 5);
          const pct1m  = perfFromBars(bars, 21);
          const pct3m  = perfFromBars(bars, 63);
          const pct6m  = perfFromBars(bars, 126);

          // YTD: from first trading day of current year
          const now     = new Date();
          const ytdDays = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));
          const pctYtd  = perfFromBars(bars, Math.min(ytdDays, bars.length - 1));

          // Which pct to use for sorting based on period param
          let sortPct: number;
          switch (period) {
            case '1w':  sortPct = pct1w  ?? 0; break;
            case '1m':  sortPct = pct1m  ?? 0; break;
            case 'ytd': sortPct = pctYtd ?? 0; break;
            default:    sortPct = change1d;     break; // 'today'
          }

          return {
            name:    t.theme,
            etf:     t.etf,
            sector:  t.sector,
            price:   parseFloat(price.toFixed(2)),
            pct:     sortPct,
            pct1d:   change1d,
            pct1w:   pct1w   ?? 0,
            pct1m:   pct1m   ?? 0,
            pct3m:   pct3m   ?? 0,
            pct6m:   pct6m   ?? 0,
            pctYtd:  pctYtd  ?? 0,
            stocks:  [], // reserved for future top stocks per theme
          };
        } catch (e) {
          return null;
        }
      }));

      chunkResults.forEach(r => { if (r) results.push(r); });
      if (i % 20 === 0 && i > 0) await sleep(200);
    }

    // Sort by selected period performance
    results.sort((a, b) => b.pct - a.pct);

    return NextResponse.json(results);

  } catch (err: any) {
    console.error('[themes]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
