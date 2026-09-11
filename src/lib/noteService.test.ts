import { describe, expect, it } from 'vitest'
import { isNoteInAccount } from './noteService'

describe('isNoteInAccount', () => {
  it('is visible when its account_id matches the selected account', () => {
    expect(isNoteInAccount({ account_id: 'acct-a' }, 'acct-a')).toBe(true)
  })

  it('is NOT visible under a different account', () => {
    expect(isNoteInAccount({ account_id: 'acct-a' }, 'acct-b')).toBe(false)
  })

  it('a note with no account_id (legacy, or saved with none selected) is visible under ANY account', () => {
    expect(isNoteInAccount({ account_id: null }, 'acct-a')).toBe(true)
    expect(isNoteInAccount({ account_id: null }, 'acct-b')).toBe(true)
  })
})
