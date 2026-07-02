import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assignTheme } from '@/lib/themes';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// One-off / re-runnable maintenance endpoint: recomputes `theme` for every
// stock that already has sector+industry data, using the current
// assignTheme() logic in lib/themes.ts. Does NOT call FMP or Polygon —
// purely reprocesses data already sitting in scanner_cache. Use this after
// changing theme keyword mappings so existing rows pick up the fix without
// waiting for a full re-enrichment cycle.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: cached, error: readErr } = await supabase
      .from('scanner_cache')
      .select('data')
      .eq('id', 'momentum')
      .single();

    if (readErr || !cached?.data) {
      return NextResponse.json({ error: 'No momentum cache found.' }, { status: 404 });
    }

    const stocks: any[] = cached.data;
    let changed = 0;

    const retagged = stocks.map(s => {
      if (!s.sector && !s.industry) return s; // nothing to retag
      const newTheme = assignTheme(s.sector ?? null, s.industry ?? null);
      if (newTheme !== s.theme) changed++;
      return { ...s, theme: newTheme };
    });

    await supabase.from('scanner_cache').upsert({
      id: 'momentum',
      data: retagged,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      totalStocks: stocks.length,
      themesChanged: changed,
    });

  } catch (err: any) {
    console.error('[retheme]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
