// Pure commission math, shared by the Stripe webhook's invoice.paid and
// charge.refunded handlers. No Supabase/Stripe imports -- keeps this
// unit-testable without mocking either SDK.

const round2 = (n: number) => Math.round(n * 100) / 100

// True when `nowIso` falls on or before `months` months after `signupIso`
// (inclusive boundary -- the exact N-months-later instant still counts).
export function isWithinCommissionWindow(signupIso: string, months: number, nowIso: string): boolean {
  const cutoff = new Date(signupIso)
  cutoff.setUTCMonth(cutoff.getUTCMonth() + months)
  return new Date(nowIso).getTime() <= cutoff.getTime()
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
