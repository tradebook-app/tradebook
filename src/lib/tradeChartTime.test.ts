import { describe, expect, it } from 'vitest'
import { tradeTimeToChartTime } from './tradeChartTime'

// Mirrors the intraday conversion in src/app/api/candles/route.ts: Twelve Data
// returns exchange-local wall-clock datetimes, which the route pins to UTC.
const candleTime = (exchangeLocal: string) =>
  Math.floor(new Date(exchangeLocal.replace(' ', 'T') + 'Z').getTime() / 1000)

describe('tradeTimeToChartTime — daily', () => {
  it('returns the calendar date regardless of the stored zone/precision', () => {
    expect(tradeTimeToChartTime('2024-01-05T14:30:00+00:00', false)).toBe('2024-01-05')
    expect(tradeTimeToChartTime('2024-01-05T00:00:00.000Z', false)).toBe('2024-01-05')
    expect(tradeTimeToChartTime('2024-01-05', false)).toBe('2024-01-05')
  })
})

describe('tradeTimeToChartTime — intraday', () => {
  // Regression: every one of these produced NaN under the old
  // `slice + 'T' + slice + 'Z'` concatenation, which dropped the marker.
  it.each([
    '2024-01-05T14:30:00+00:00',
    '2024-01-05T14:30:00.000Z',
    '2024-01-05T14:30:00Z',
    '2024-01-05T14:30:00-05:00',
    '2024-01-05 14:30:00+00',
    '2024-01-05T14:30',
    '2024-01-05T14:30:00',
  ])('never returns NaN for %s', (iso) => {
    const t = tradeTimeToChartTime(iso, true)
    expect(typeof t).toBe('number')
    expect(Number.isNaN(t as number)).toBe(false)
  })

  it('pins the wall clock to UTC, matching the candle route', () => {
    expect(tradeTimeToChartTime('2024-01-05T09:30:00+00:00', true)).toBe(
      candleTime('2024-01-05 09:30:00'),
    )
  })

  it('lands exactly on a 15-minute candle boundary', () => {
    const t = tradeTimeToChartTime('2024-03-11T13:45:00+00:00', true) as number
    expect(t % 900).toBe(0)
    expect(t).toBe(candleTime('2024-03-11 13:45:00'))
  })

  it('keeps the wall-clock digits even when the stored offset is non-UTC', () => {
    // Consistent with the daily path, which also ignores the offset (slice).
    expect(tradeTimeToChartTime('2024-01-05T14:30:00-05:00', true)).toBe(
      candleTime('2024-01-05 14:30:00'),
    )
  })

  it('ignores sub-second precision', () => {
    expect(tradeTimeToChartTime('2024-01-05T14:30:00.123Z', true)).toBe(
      candleTime('2024-01-05 14:30:00'),
    )
  })

  it('orders entry before exit for a same-day intraday trade', () => {
    const entry = tradeTimeToChartTime('2024-01-05T09:45:00+00:00', true) as number
    const exit = tradeTimeToChartTime('2024-01-05T14:15:00+00:00', true) as number
    expect(entry).toBeLessThan(exit)
  })

  it('falls back to a finite number for a date-only value', () => {
    const t = tradeTimeToChartTime('2024-01-05', true)
    expect(typeof t).toBe('number')
    expect(Number.isFinite(t as number)).toBe(true)
  })
})
