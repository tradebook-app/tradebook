import { describe, expect, it } from 'vitest'
import { formatCumulativeAxisTick } from './chartFormat'

describe('formatCumulativeAxisTick — percent', () => {
  // The regression. cumPct for a single trading day (e.g. -$625 on a $30k
  // account => -2.08%) is one point; Chart.js 4.5 expands min/max by +-5% and
  // spaces ticks ~0.05 apart. The old `v => Number(v).toFixed(0) + '%'` turned
  // every one of these into "-2%".
  const narrowTicks = [-2.2, -2.15, -2.1, -2.05, -2, -1.95]

  it('keeps sub-1% gridlines distinct', () => {
    const labels = narrowTicks.map(t => formatCumulativeAxisTick(t, '%'))
    expect(labels).toEqual(['-2.2%', '-2.15%', '-2.1%', '-2.05%', '-2%', '-1.95%'])
    expect(new Set(labels).size).toBe(narrowTicks.length)
  })

  it('documents that the old formatter collapsed them to one label', () => {
    const old = (v: number) => `${Number(v).toFixed(0)}%`
    expect(new Set(narrowTicks.map(old))).toEqual(new Set(['-2%']))
  })

  it('trims trailing zeros so whole values stay clean', () => {
    expect(formatCumulativeAxisTick(-2, '%')).toBe('-2%')
    expect(formatCumulativeAxisTick(0, '%')).toBe('0%')
    expect(formatCumulativeAxisTick(50, '%')).toBe('50%')
    expect(formatCumulativeAxisTick(-2.1, '%')).toBe('-2.1%')
  })

  it('absorbs Chart.js floating-point noise', () => {
    expect(formatCumulativeAxisTick(-2.1500000000000004, '%')).toBe('-2.15%')
    expect(formatCumulativeAxisTick(2.3333333, '%')).toBe('2.33%')
  })

  it('wide ranges still read cleanly', () => {
    expect([0, 25, 50, 75, 100].map(v => formatCumulativeAxisTick(v, '%')))
      .toEqual(['0%', '25%', '50%', '75%', '100%'])
  })
})

describe('formatCumulativeAxisTick — dollars (unchanged behaviour)', () => {
  it('rounds to whole dollars', () => {
    expect(formatCumulativeAxisTick(1200, '$')).toBe('$1200')
    expect(formatCumulativeAxisTick(0, '$')).toBe('$0')
    expect(formatCumulativeAxisTick(-624.96, '$')).toBe('$-625')
  })
})
