import { NextResponse } from 'next/server';

const FMP = 'https://financialmodelingprep.com';
const KEY = process.env.FMP_API_KEY;

export async function GET(request: Request, { params }: { params: { ticker: string } }) {
  try {
    if (!KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 });

    const ticker = params.ticker.toUpperCase();

    const [quoteRes, changeRes] = await Promise.all([
      fetch(`${FMP}/stable/quote?symbol=${ticker}&apikey=${KEY}`, { next: { revalidate: 60 } }),
      fetch(`${FMP}/stable/stock-price-change?symbol=${ticker}&apikey=${KEY}`, { next: { revalidate: 300 } }),
    ]);

    const quoteData  = await quoteRes.json();
    const changeData = await changeRes.json();

    const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;
    if (!quote) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });

    return NextResponse.json({ quote, change: Array.isArray(changeData) ? changeData[0] : changeData });
  } catch (err: any) {
    console.error('[scanner/quote]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
