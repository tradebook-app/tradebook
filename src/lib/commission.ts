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
