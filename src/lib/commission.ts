// Pure commission math, shared by the Stripe webhook's invoice.paid and
// charge.refunded handlers. No Supabase/Stripe imports -- keeps this
// unit-testable without mocking either SDK.

const round2 = (n: number) => Math.round(n * 100) / 100

// True when `nowIso` falls on or before `months` months after `signupIso`
// (inclusive boundary -- the exact N-months-later instant still counts).
export function isWithinCommissionWindow(signupIso: string, months: number, nowIso: string): boolean {
  const cutoff = new Date(signupIso)
  // UTC methods, not local-time: this runs in a serverless webhook handler where the
  // server's TZ is not guaranteed, and local-time month arithmetic could shift this
  // money-boundary check depending on where the function executes.
  cutoff.setUTCMonth(cutoff.getUTCMonth() + months)
  return new Date(nowIso).getTime() <= cutoff.getTime()
}

// True when `nowIso` falls on or between `windowStart` and `windowEnd`
// (inclusive both ends). Used for the partner track's absolute
// commission-eligibility date range, set by an admin -- unlike
// isWithinCommissionWindow, this is NOT relative to any referred user's
// signup date. Either bound missing means no window has been configured,
// which is treated as "not eligible", never "always eligible".
export function isWithinAbsoluteWindow(
  windowStartIso: string | null,
  windowEndIso: string | null,
  nowIso: string,
): boolean {
  if (!windowStartIso || !windowEndIso) return false
  const now = new Date(nowIso).getTime()
  return now >= new Date(windowStartIso).getTime() && now <= new Date(windowEndIso).getTime()
}

// `amountPaidCents` is Stripe's integer cents (e.g. invoice.amount_paid).
// Returns null for zero/negative amounts -- there is nothing to commission.
export function computeCommission(
  amountPaidCents: number,
  rate: number,
): { grossUsd: number; commissionUsd: number } | null {
  if (amountPaidCents <= 0) return null
  const grossUsd = round2(amountPaidCents / 100)
  return { grossUsd, commissionUsd: round2(grossUsd * rate) }
}

// Groups commission rows by the UTC calendar month of `created_at`
// (YYYY-MM), summing `commission_amount` per month. A reversal row's
// commission_amount is already negative, so a reversal in the same month
// as its original nets out automatically -- no special-casing needed.
// Sorted ascending by month; a month with no rows is simply absent (no
// zero-filled gaps) -- callers decide how to render sparse data.
export function bucketMonthlyCommissions(
  rows: { created_at: string; commission_amount: number }[]
): { month: string; commission: number }[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const d = new Date(row.created_at)
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    totals.set(month, (totals.get(month) || 0) + Number(row.commission_amount))
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, commission]) => ({ month, commission: round2(commission) }))
}
