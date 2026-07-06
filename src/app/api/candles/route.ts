import { NextRequest, NextResponse } from 'next/server';

async function fetchTwelveData(symbol: string, interval: string, apiKey: string, startDate?: string | null, endDate?: string | null) {
  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('outputsize', '500');
  if (startDate) url.searchParams.set('start_date', startDate);
  if (endDate) url.searchParams.set('end_date', endDate);

  const res = await fetch(url.toString());
  const data = await res.json();
  return data;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');
  const requestedInterval = searchParams.get('interval') || '15min';

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing API key' }, { status: 500 });
  }

  try {
    let interval = requestedInterval;
    let data = await fetchTwelveData(symbol, interval, apiKey, startDate, endDate);

    // Fall back to daily if the requested interval has no data
    if (data.status === 'error' && interval !== '1day') {
      data = await fetchTwelveData(symbol, '1day', apiKey, startDate, endDate);
      interval = '1day';
    }

    if (data.status === 'error') {
      return NextResponse.json({ error: data.message || 'Twelve Data error' }, { status: 502 });
    }

    const isIntraday = interval !== '1day';

    const candles = (data.values || [])
      .map((v: any) => {
        if (isIntraday) {
          const unixTime = Math.floor(new Date(v.datetime.replace(' ', 'T') + 'Z').getTime() / 1000);
          return {
            time: unixTime,
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
          };
        } else {
          return {
            time: v.datetime.slice(0, 10),
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
          };
        }
      })
      .reverse();

    return NextResponse.json({ candles, interval });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch candle data' }, { status: 500 });
  }
}
