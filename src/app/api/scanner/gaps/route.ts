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
      .eq('id', 'gaps')
      .single();

    // DEBUG: expose the actual error and what came back
    if (error) {
      return NextResponse.json({
        debug: true,
        stage: 'supabase_error',
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        error_code: error.code,
        supabase_url_present: !!SUPABASE_URL,
        supabase_key_present: !!SUPABASE_KEY,
      }, { status: 200 });
    }

    if (!data) {
      return NextResponse.json({
        debug: true,
        stage: 'no_data_returned',
        data_is_null: true,
      }, { status: 200 });
    }

    // Success — return how many rows we got
    const count = Array.isArray(data.data) ? data.data.length : 'not-an-array';
    return NextResponse.json({
      debug: true,
      stage: 'success',
      count,
      updated_at: data.updated_at,
      first_item: Array.isArray(data.data) ? data.data[0] : data.data,
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({
      debug: true,
      stage: 'exception',
      message: err.message,
    }, { status: 200 });
  }
}
