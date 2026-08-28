/**
 * Convert a stored trade timestamp (Postgres `timestamptz`, e.g.
 * "2024-01-05T14:30:00+00:00" or "2024-01-05T14:30:00.000Z") into the time key
 * lightweight-charts expects for the candle interval currently on screen.
 *
 * - Daily charts key each bar by calendar date ("YYYY-MM-DD").
 * - Intraday charts key each bar by a UNIX timestamp in **seconds**. Our
 *   /api/candles route builds those from Twelve Data's exchange-local wall
 *   clock by re-stamping it as UTC ("2024-01-05 09:30:00" ET -> 09:30:00Z), so
 *   we mirror that here: take the wall-clock components and pin them to UTC.
 *
 * Why this helper exists: the previous inline logic did
 * `d.slice(0,10) + 'T' + d.slice(11) + 'Z'`, which appends a second zone
 * designator to an already-zoned string ("...+00:00Z" / "...000ZZ").
 * `new Date()` rejects that as Invalid Date, the marker time became `NaN`, and
 * lightweight-charts silently dropped the marker — so entry/exit markers never
 * appeared on the 15m/1H timeframes, only on 1D (which uses the date-only path).
 */
export function tradeTimeToChartTime(iso: string, isIntraday: boolean): string | number {
  if (!isIntraday) return iso.slice(0, 10)

  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m
    return Math.floor(
      Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? 0)) / 1000,
    )
  }

  // Date-only or an unrecognised shape: fall back to a straight parse, and
  // finally to the date string, so we never emit NaN.
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? iso.slice(0, 10) : Math.floor(parsed / 1000)
}
