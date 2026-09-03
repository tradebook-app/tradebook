import { describe, expect, it } from 'vitest'
import { shouldPopulateForm, tradeFormKey } from './tradeFormInit'

describe('tradeFormKey', () => {
  it('is null while the modal is closed', () => {
    expect(tradeFormKey(false, 'abc')).toBeNull()
  })
  it('distinguishes a new trade from editing one', () => {
    expect(tradeFormKey(true, null)).toBe('new')
    expect(tradeFormKey(true, 'abc')).toBe('edit:abc')
  })
})

describe('shouldPopulateForm', () => {
  it('populates the first time a trade opens', () => {
    const r = shouldPopulateForm(null, true, 'abc')
    expect(r).toEqual({ populate: true, nextKey: 'edit:abc' })
  })

  it('does NOT re-populate on a later render of the same open trade', () => {
    // this is the regression: the strategies list changing (e.g. after the
    // user creates a strategy inline) must not wipe the form back to defaults
    const first = shouldPopulateForm(null, true, 'abc')
    const second = shouldPopulateForm(first.nextKey, true, 'abc')
    expect(second.populate).toBe(false)
    expect(second.nextKey).toBe('edit:abc')
  })

  it('re-populates when the modal switches to a different trade', () => {
    const r = shouldPopulateForm('edit:abc', true, 'xyz')
    expect(r).toEqual({ populate: true, nextKey: 'edit:xyz' })
  })

  it('resets when the modal closes, so the next open populates again', () => {
    const closed = shouldPopulateForm('edit:abc', false, null)
    expect(closed).toEqual({ populate: false, nextKey: null })
    const reopened = shouldPopulateForm(closed.nextKey, true, 'abc')
    expect(reopened.populate).toBe(true)
  })
})
