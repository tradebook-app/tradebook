// Decides whether the Add/Edit Trade form should (re)populate its fields from
// the trade being edited. The form's population effect depends on the
// `strategies` list (it matches a legacy setup label to a strategy), so it
// re-fires whenever that list changes — including right after the user creates
// a strategy inline. Re-populating at that moment throws away the strategy the
// user just picked. This keys population to "which trade, this open" so it runs
// exactly once per open and never fights the user's edits.

export function tradeFormKey(open: boolean, editTradeId: string | null | undefined): string | null {
  if (!open) return null
  return editTradeId ? `edit:${editTradeId}` : 'new'
}

export function shouldPopulateForm(
  prevKey: string | null,
  open: boolean,
  editTradeId: string | null | undefined,
): { populate: boolean; nextKey: string | null } {
  const key = tradeFormKey(open, editTradeId)
  if (key === null) return { populate: false, nextKey: null }
  if (prevKey === key) return { populate: false, nextKey: key }
  return { populate: true, nextKey: key }
}
