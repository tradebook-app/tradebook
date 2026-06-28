import { NextResponse } from 'next/server';

const BASE = 'https://financialmodelingprep.com/stable';
const KEY  = process.env.FMP_API_KEY;

export async function GET(request: Request, { params }: { params: { ticker: string } }) {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });
    const ticker = params.ticker.toUpperCase();

    const [qRes, hRes] = await Promise.all([
      fetch(`${BASE}/quote?symbol=${ticker}&apikey=${KEY}`, { next: { revalidate: 60 } }),
      fetch(`${BASE}/historical-price-eod/full?symbol=${ticker}&limit=130&apikey=${KEY}`, { next: { revalidate: 300 } }),
    ]);

    const qData = await qRes.json();
    const hData = await hRes.json();
    const quote = Array.isArray(qData) ? qData[0] : qData;
    if (!quote) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });

    return NextResponse.json({ quote, history: Array.isArray(hData) ? hData : (hData?.historical || []) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
