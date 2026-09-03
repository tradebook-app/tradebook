import { describe, expect, it } from 'vitest'
import { filterByStatus, isTradeClosed } from './tradeTableFilters'

type T = { exit: number | null; pnl: number }

const closedWin:  T = { exit: 12,   pnl: 340 }
const closedLoss: T = { exit: 8,    pnl: -110 }
const closedBe:   T = { exit: 10,   pnl: 0 }
const openNull:   T = { exit: null, pnl: 0 }
const openZero:   T = { exit: 0,    pnl: 0 }

const all = [closedWin, closedLoss, closedBe, openNull, openZero]

describe('isTradeClosed', () => {
  it('is true only when a positive exit price exists', () => {
    expect(isTradeClosed(closedWin)).toBe(true)
    expect(isTradeClosed(openNull)).toBe(false)
    expect(isTradeClosed(openZero)).toBe(false)
  })
})

describe('filterByStatus', () => {
  it('"all" returns every trade, open and closed', () => {
    expect(filterByStatus(all, 'all')).toHaveLength(5)
  })

  it('"open" returns only trades with no exit', () => {
    expect(filterByStatus(all, 'open')).toEqual([openNull, openZero])
  })

  it('win / loss / breakeven never include open trades', () => {
    expect(filterByStatus(all, 'win')).toEqual([closedWin])
    expect(filterByStatus(all, 'loss')).toEqual([closedLoss])
    // openNull and openZero both have pnl 0 but must NOT count as breakeven
    expect(filterByStatus(all, 'be')).toEqual([closedBe])
  })
})
