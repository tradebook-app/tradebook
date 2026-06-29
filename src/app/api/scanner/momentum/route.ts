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
      return NextResponse.json(
        { error: 'No cached data yet. Please run /api/scanner/cache?token=YOUR_TOKEN to populate.' },
        { status: 404 }
      );
    }

    return NextResponse.json(data.data, {
      headers: {
        'X-Cache-Updated': data.updated_at,
      },
    });

  } catch (err: any) {
    console.error('[scanner/momentum]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
