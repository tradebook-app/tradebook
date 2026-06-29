import { NextResponse } from 'next/server';

const POLYGON_KEY = process.env.POLYGON_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'No symbol' }, { status: 400 });

  try {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1); // 1 year of daily bars
    const fromStr = from.toISOString().split('T')[0];
    const toStr   = new Date().toISOString().split('T')[0];

    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=365&apiKey=${POLYGON_KEY}`,
      { cache: 'no-store' }
    );

    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });

    const data = await res.json();
    const bars = (data.results || []).map((b: any) => ({
      time:   Math.floor(b.t / 1000), // unix seconds
      open:   b.o,
      high:   b.h,
      low:    b.l,
      close:  b.c,
      volume: b.v,
    }));

    return NextResponse.json({ symbol, bars });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
