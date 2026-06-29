import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const FMP_BASE     = 'https://financialmodelingprep.com/stable';
const FMP_KEY      = process.env.FMP_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

// ─── Theme assignment (inline — no import needed) ─────────────────────────────
const THEME_KEYWORDS: { theme: string; keywords: string[] }[] = [
  { theme: 'Biotech',               keywords: ['biotechnology', 'biotech'] },
  { theme: 'Medical Devices',       keywords: ['medical devices', 'medical instruments', 'diagnostics'] },
  { theme: 'Pharmaceuticals',       keywords: ['pharmaceuticals', 'drug manufacturers'] },
  { theme: 'Healthcare Providers',  keywords: ['healthcare providers', 'managed health', 'hospitals'] },
  { theme: 'Home Builders',         keywords: ['residential construction', 'home builders', 'homebuilding'] },
  { theme: 'REITs',                 keywords: ['reit', 'real estate investment', 'real estate services'] },
  { theme: 'Food & Beverage',       keywords: ['food', 'beverage', 'packaged foods', 'grocery'] },
  { theme: 'Restaurants',           keywords: ['restaurant', 'fast food', 'food service'] },
  { theme: 'Leisure & Entertainment',keywords: ['leisure', 'entertainment', 'gaming', 'casinos', 'hotels', 'travel'] },
  { theme: 'Retail',                keywords: ['retail', 'specialty retail', 'department stores'] },
  { theme: 'Online Retail',         keywords: ['internet retail', 'e-commerce', 'online retail'] },
  { theme: 'Cannabis',              keywords: ['cannabis', 'marijuana'] },
  { theme: 'Electric Vehicles',     keywords: ['electric vehicle', 'auto manufacturers', 'automobile'] },
  { theme: 'Cloud Computing',       keywords: ['cloud', 'saas', 'software infrastructure', 'information technology services'] },
  { theme: 'Cryptocurrency',        keywords: ['cryptocurrency', 'crypto', 'blockchain', 'bitcoin'] },
  { theme: 'Cybersecurity',         keywords: ['cybersecurity', 'security software', 'network security'] },
  { theme: 'AI & Tech',             keywords: ['artificial intelligence', 'machine learning'] },
  { theme: 'Internet',              keywords: ['internet content', 'internet services'] },
  { theme: 'Nanotechnology',        keywords: ['nanotechnology', 'nano'] },
  { theme: 'Semiconductors',        keywords: ['semiconductors', 'semiconductor', 'chips', 'integrated circuits'] },
  { theme: 'Fintech',               keywords: ['fintech', 'financial technology', 'payment processing', 'credit services'] },
  { theme: 'Social Media',          keywords: ['social media', 'social network'] },
  { theme: 'Software',              keywords: ['software', 'application software', 'software—application', 'software-application'] },
  { theme: 'Robotics & Automation', keywords: ['robotics', 'automation', 'industrial automation', 'scientific instruments'] },
  { theme: 'Banks',                 keywords: ['money center banks'] },
  { theme: 'Regional Banks',        keywords: ['regional banks', 'savings institutions'] },
  { theme: 'Capital Markets',       keywords: ['capital markets', 'asset management', 'investment banking'] },
  { theme: 'Insurance',             keywords: ['insurance', 'life insurance', 'property insurance', 'reinsurance'] },
  { theme: 'Aerospace & Defense',   keywords: ['aerospace', 'defense', 'aerospace & defense'] },
  { theme: 'Airlines',              keywords: ['airlines', 'airline'] },
  { theme: 'Transportation',        keywords: ['trucking', 'railroads', 'logistics'] },
  { theme: 'Shipping',              keywords: ['shipping', 'marine', 'sea freight'] },
  { theme: 'Water Resources',       keywords: ['water utilities', 'water treatment'] },
  { theme: 'Agriculture',           keywords: ['agriculture', 'farm products', 'fertilizers'] },
  { theme: 'Gold Miners',           keywords: ['gold mining', 'gold miners'] },
  { theme: 'Gold',                  keywords: ['gold', 'precious metals'] },
  { theme: 'Silver',                keywords: ['silver miners', 'silver'] },
  { theme: 'Copper Miners',         keywords: ['copper mining', 'copper'] },
  { theme: 'Uranium',               keywords: ['uranium', 'nuclear'] },
  { theme: 'Steel',                 keywords: ['steel', 'iron'] },
  { theme: 'Metals & Mining',       keywords: ['mining', 'diversified metals'] },
  { theme: 'Battery & Lithium',     keywords: ['lithium', 'battery', 'energy storage'] },
  { theme: 'Natural Resources',     keywords: ['natural resources', 'diversified commodities'] },
  { theme: 'Clean Energy',          keywords: ['clean energy', 'renewable energy'] },
  { theme: 'Solar',                 keywords: ['solar'] },
  { theme: 'Wind',                  keywords: ['wind energy', 'wind power'] },
  { theme: 'Natural Gas',           keywords: ['natural gas', 'gas utilities'] },
  { theme: 'Oil',                   keywords: ['oil', 'crude oil', 'oil & gas'] },
  { theme: 'MLP',                   keywords: ['mlp', 'midstream', 'pipeline'] },
  { theme: 'Infrastructure',        keywords: ['infrastructure', 'electric utilities', 'multi-utilities'] },
  { theme: 'Communication Services',keywords: ['communication', 'telecom', 'wireless'] },
];

function assignTheme(sector: string | null, industry: string | null): string | null {
  if (!sector && !industry) return null;
  const combined = `${(sector||'').toLowerCase()} ${(industry||'').toLowerCase()}`;
  for (const t of THEME_KEYWORDS) {
    for (const kw of t.keywords) {
      if (combined.includes(kw.toLowerCase())) return t.theme;
    }
  }
  const s = (sector || '').toLowerCase();
  if (s.includes('technology'))             return 'Software';
  if (s.includes('healthcare'))             return 'Pharmaceuticals';
  if (s.includes('financial'))              return 'Capital Markets';
  if (s.includes('energy'))                 return 'Oil';
  if (s.includes('basic materials'))        return 'Metals & Mining';
  if (s.includes('industrials'))            return 'Transportation';
  if (s.includes('consumer discretionary')) return 'Retail';
  if (s.includes('consumer staples'))       return 'Food & Beverage';
  if (s.includes('real estate'))            return 'REITs';
  if (s.includes('utilities'))              return 'Infrastructure';
  if (s.includes('communication'))          return 'Communication Services';
  return null;
}

export async function GET(request: Request) {
  // Allow both cron (no token) and manual trigger (with token)
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const isCron = request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron && token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[enrich] Starting FMP enrichment cron...');

    // Read existing momentum cache from Supabase
    const { data: cached, error: readErr } = await supabase
      .from('scanner_cache')
      .select('data')
      .eq('id', 'momentum')
      .single();

    if (readErr || !cached?.data) {
      return NextResponse.json({ error: 'No momentum cache found. Run /api/scanner/cache first.' }, { status: 404 });
    }

    const stocks: any[] = cached.data;
    console.log(`[enrich] Loaded ${stocks.length} stocks from cache`);

    // Process ALL stocks but skip already enriched ones
    // This way each cron run picks up where it left off
    const toEnrich = stocks.filter(s => !s.sector); // only unenriched
    const alreadyDone = stocks.filter(s => s.sector); // already have data

    console.log(`[enrich] ${alreadyDone.length} already enriched, ${toEnrich.length} remaining`);

    if (toEnrich.length === 0) {
      console.log('[enrich] All stocks already enriched!');
      return NextResponse.json({ success: true, enriched: 0, message: 'All stocks already enriched' });
    }

    const BATCH = 5;
    const enriched = [...toEnrich];

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
          // skip failed
        }
      }));

      // Save progress every 200 stocks
      if (i % 200 === 0 && i > 0) {
        await saveRanked([...enriched, ...alreadyDone], supabase);
        console.log(`[enrich] Progress: ${i}/${enriched.length}`);
      }

      await sleep(100); // gentle rate limiting
    }

    // Final save
    await saveRanked([...enriched, ...alreadyDone], supabase);
    console.log(`[enrich] Done! Enriched ${enriched.length} stocks.`);

    return NextResponse.json({
      success:         true,
      newlyEnriched:   enriched.length,
      alreadyEnriched: alreadyDone.length,
      total:           stocks.length,
      updated_at:      new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('[enrich]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function saveRanked(all: any[], supabase: any) {
  const allEps      = all.map(r => r.epsCombined).filter((v): v is number => v !== null);
  const allRev      = all.map(r => r.revGrowth).filter((v): v is number => v !== null);
  const allRsScores = all.map(r => r.rsScore ?? r.m6); // fallback to m6 for old data

  const reranked = all.map(r => ({
    ...r,
    rs:      rank99(r.rsScore ?? r.m6, allRsScores, true),
    epsRank: r.epsCombined != null ? rank99(r.epsCombined, allEps, true) : null,
    revRank: r.revGrowth   != null ? rank99(r.revGrowth,   allRev, true) : null,
  })).sort((a, b) => b.rs - a.rs);

  await supabase.from('scanner_cache').upsert({
    id: 'momentum', data: reranked, updated_at: new Date().toISOString(),
  });
}
