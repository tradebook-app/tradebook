import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from('scanner_cache')
      .select('data, updated_at')
      .eq('id', 'momentum')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'No cache found.' }, { status: 404 });
    }

    // Filter to stocks that have fundamental data and sort by EPS rank
    const stocks = (data.data as any[])
      .filter(s => s.epsCombined != null || s.revGrowth != null)
      .map(s => ({
        ticker:    s.ticker,
        name:      s.name,
        price:     s.price,
        sector:    s.sector,
        industry:  s.industry,
        theme:     s.theme,
        mktCap:    s.mktCap,
        rs:        s.rs,
        epsRank:   s.epsRank,
        revRank:   s.revRank,
        epsQ0:     s.epsQ0,
        epsQ1:     s.epsQ1,
        epsAnn:    s.epsAnn,
        epsCombined: s.epsCombined,
        revGrowth: s.revGrowth,
        adr:       s.adr,
        float:     s.floatShares || null,
      }))
      .sort((a, b) => (b.epsRank || 0) - (a.epsRank || 0));

    return NextResponse.json(stocks, {
      headers: { 'X-Cache-Updated': data.updated_at },
    });

  } catch (err: any) {
    console.error('[fundamentals]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
