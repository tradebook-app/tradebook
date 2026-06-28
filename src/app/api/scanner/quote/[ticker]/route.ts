import { NextResponse } from 'next/server';

const FMP = 'https://financialmodelingprep.com';
const KEY = process.env.FMP_API_KEY;

export async function GET(request: Request, { params }: { params: { ticker: string } }) {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });
    const ticker = params.ticker.toUpperCase();

    const [quoteRes, histRes] = await Promise.all([
      fetch(`${FMP}/api/v3/quote/${ticker}?apikey=${KEY}`, { next: { revalidate: 60 } }),
      fetch(`${FMP}/api/v3/historical-price-full/${ticker}?timeseries=130&apikey=${KEY}`, { next: { revalidate: 300 } }),
    ]);

    const quoteData = await quoteRes.json();
    const histData  = await histRes.json();

    const quote   = Array.isArray(quoteData) ? quoteData[0] : quoteData;
    const history = histData?.historical || [];

    if (!quote) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });

    return NextResponse.json({ quote, history });
  } catch (err: any) {
    console.error('[scanner/quote]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
