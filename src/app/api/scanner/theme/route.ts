import { NextResponse } from 'next/server';
import { THEME_ETF_MAP } from '@/lib/themes';
import { createClient } from '@supabase/supabase-js';

// Without this, Vercel falls back to a short default timeout. This route
// fetches ~57 ETF snapshots from Polygon across sequential batches, which
// can exceed that default — causing Vercel to return its own HTML timeout
// page instead of JSON, which then fails client-side JSON.parse() with
// "Unexpected token '<'".
export const maxDuration = 60;

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const SECTOR_ETFS = [
  { name: 'Technology',             etf: 'XLK' },
  { name: 'Healthcare',             etf: 'XLV' },
  { name: 'Financials',             etf: 'XLF' },
  { name: 'Consumer Disc.',         etf: 'XLY' },
  { name: 'Industrials',            etf: 'XLI' },
  { name: 'Communication',          etf: 'XLC' },
  { name: 'Consumer Staples',       etf: 'XLP' },
  { name: 'Energy',                 etf: 'XLE' },
  { name: 'Real Estate',            etf: 'XLRE' },
  { name: 'Materials',              etf: 'XLB' },
  { name: 'Utilities',              etf: 'XLU' },
];

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

async function fetchETFData(ticker: string) {
  const [snap, bars] = await Promise.all([
    fetchSnapshot(ticker),
    fetchBars(ticker, 260),
  ]);
  const price    = snap?.price || bars[0]?.c || 0;
  const change1d = snap?.change1d || 0;
  const now      = new Date();
  const ytdDays  = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));
  return {
    price:   parseFloat(price.toFixed(2)),
    pct1d:   change1d,
    pct1w:   perfFromBars(bars, 5)   ?? 0,
    pct1m:   perfFromBars(bars, 21)  ?? 0,
    pct3m:   perfFromBars(bars, 63)  ?? 0,
    pct6m:   perfFromBars(bars, 126) ?? 0,
    pctYtd:  perfFromBars(bars, Math.min(ytdDays, bars.length - 1)) ?? 0,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'today';

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Load momentum cache and group by theme (free — already in Supabase)
    const { data: cached } = await supabase
      .from('scanner_cache')
      .select('data')
      .eq('id', 'momentum')
      .single();

    const themeStocksMap: Record<string, any[]> = {};
    if (cached?.data) {
      const stocks: any[] = cached.data;
      for (const stock of stocks) {
        if (!stock.theme || stock.rs == null) continue;
        if (!themeStocksMap[stock.theme]) themeStocksMap[stock.theme] = [];
        themeStocksMap[stock.theme].push(stock);
      }
      for (const theme in themeStocksMap) {
        themeStocksMap[theme] = themeStocksMap[theme]
          .sort((a, b) => (b.rs || 0) - (a.rs || 0))
          .slice(0, 10)
          .map(s => ({
            t:  s.ticker,
            n:  s.name || s.ticker,
            p:  (s.m6 > 0 ? '+' : '') + (s.m6 || 0).toFixed(1) + '%',
            rs: s.rs,
          }));
      }
    }

    // Fetch sectors and themes concurrently
    const [sectorResults, themeResults] = await Promise.all([
      // Sectors
      Promise.all(SECTOR_ETFS.map(async (s) => {
        try {
          const d = await fetchETFData(s.etf);
          const pct = period === '1w' ? d.pct1w : period === '1m' ? d.pct1m : period === '3m' ? d.pct3m : period === '6m' ? d.pct6m : period === 'ytd' ? d.pctYtd : d.pct1d;
          return { ...s, ...d, pct };
        } catch { return null; }
      })),

      // Themes
      (async () => {
        const results: any[] = [];
        const CONCURRENCY = 10;
        for (let i = 0; i < THEME_ETF_MAP.length; i += CONCURRENCY) {
          const chunk = THEME_ETF_MAP.slice(i, i + CONCURRENCY);
          const chunkResults = await Promise.all(chunk.map(async (t) => {
            try {
              const d = await fetchETFData(t.etf);
              const pct = period === '1w' ? d.pct1w : period === '1m' ? d.pct1m : period === '3m' ? d.pct3m : period === '6m' ? d.pct6m : period === 'ytd' ? d.pctYtd : d.pct1d;
              return { name: t.theme, etf: t.etf, sector: t.sector, ...d, pct, stocks: themeStocksMap[t.theme] || [] };
            } catch { return null; }
          }));
          chunkResults.forEach(r => { if (r) results.push(r); });
          if (i % 20 === 0 && i > 0) await sleep(200);
        }
        return results.sort((a, b) => b.pct - a.pct);
      })(),
    ]);

    return NextResponse.json({
      sectors: sectorResults.filter(Boolean),
      themes:  themeResults,
    });

  } catch (err: any) {
    console.error('[themes]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
