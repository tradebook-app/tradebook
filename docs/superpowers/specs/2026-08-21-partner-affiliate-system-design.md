# Partner Affiliate System — Design

**Date:** 2026-08-21
**Status:** Approved design, pending implementation plan

## Goal

Add a partner/affiliate track on top of Sleektrade's existing friend-referral
system: admins assign external partners a vanity referral code and a 12-month
recurring 20% commission rate (vs. the existing 6-month friend default),
tracked in the same commission ledger, with a partner-focused admin view for
signups/revenue/payouts.

## Context: what already exists

Sleektrade (this repo) already has a working friend-invite referral program:

- `profiles.referral_code` / `referred_by` — auto-generated slug codes
  (`src/lib/referrals.ts`), attributed via `?ref=code` links
  (`attributeReferral`, exact-match on `referral_code`).
- `referral_commissions` — one row per commissioned Stripe invoice, unique on
  `stripe_invoice_id` (real idempotency). Written by
  `src/app/api/stripe/webhook/route.ts`'s `invoice.paid` handler: 20% of
  `amount_paid`, only if the payer was referred and is within **6 months of
  their signup date** (`payer.created_at`), with a 30-day holding period
  before a commission becomes payable.
- `/admin/referrals` — a flat admin page listing referrers with payout-ready
  (30-day-old, `pending`) commissions, gated by an `ADMIN_EMAILS` env-var
  allowlist checked per-route (no DB `is_admin` flag, no middleware-level
  admin gate — same gap exists today and is not being fixed by this project).

**Critical gap found during review:** `profiles` and `referral_commissions`
are used everywhere in the code but are **not defined in any committed
migration** (`supabase/migrations/` has only `001_initial_schema.sql`, which
defines `trades`/`notes`/`strategies`). The live schema for these two tables
was created out-of-band. This must be fixed before extending them.

## Decisions (locked with owner)

1. **Two-track model.** Keep the existing friend program (6 months, auto
   codes) running unchanged. Add a parallel **partner** track: admin-flagged
   accounts (`is_partner`) with an admin-assigned vanity code, 20% commission
   for 12 months. One shared `referral_commissions` ledger with a `program`
   discriminator, not a parallel table.
2. **Schema catch-up is Task 1**, before any new columns. Introspect the live
   `profiles`/`referral_commissions` shape, commit it as a real migration,
   and fix the FK/constraint gaps that bear directly on ledger correctness
   (below) — zero behavior change otherwise.
3. **Admin gate stays `ADMIN_EMAILS`** (env-var allowlist, per-route check).
   No DB-backed `is_admin` role in this project.
4. Implementation model: Sonnet 5 for the build (not Opus).

Implementation calls made during design (not separately asked, flagged here):

- **Refund handling: full-refund clawback only**, via `charge.refunded`,
  matched to a ledger row through `charge.invoice` → `stripe_invoice_id`.
  Proportional clawback for *partial* refunds is out of scope for v1.
- **Vanity codes are lowercase** `[a-z0-9-]{3,20}`, matching the existing
  slug style and the existing case-sensitive exact-match lookup in
  `attributeReferral` — avoids touching that shared matching path.
- **No middleware-level admin gating.** `/admin/referrals` has none today;
  the new `/admin/partners` route matches that existing pattern rather than
  introducing an inconsistent, unrequested fix.
- **Commission window stays "referred user's signup date + N months"** — the
  existing, simpler semantic (not IronCoach's "first ledger entry" approach),
  just parameterized by the referrer's `commission_months`.
- **Rate/months are read live from the referrer's profile at write time**,
  not snapshotted per commission row — a later rate change only affects
  future invoices, matching how the window is already computed fresh each
  time from `payer.created_at`.

## Data model

### Task 1 — catch-up migration (`002_profiles_and_referrals_catchup.sql`)

Introspect the live database via Supabase MCP and commit a migration that
reproduces the current `profiles` and `referral_commissions` shape exactly,
based on every column referenced in code today:

- `profiles`: `id` (references `auth.users`), `first_name`,
  `newsletter_opt_in`, `referral_code`, `referred_by`, `stripe_customer_id`,
  `stripe_subscription_id`, `subscription_status`, `plan`, `created_at`.
- `referral_commissions`: `id`, `referrer_id`, `referred_user_id`,
  `stripe_invoice_id` (unique), `gross_amount`, `commission_amount`,
  `status`, `available_at`, `paid_at`, `created_at`.

Add both tables to the `Database` type in `src/lib/types.ts` (currently
`referral_commissions` has a row type but no `Database.Tables` entry;
`profiles` has neither).

Fix two integrity gaps in the same migration, since they bear directly on
the ledger this project extends:

- `referral_commissions.referrer_id` FK → `on delete restrict` (a partner
  account cannot be deleted while it has ledger history — must be settled
  first). `referred_user_id` FK → `on delete set null` (a referred user
  deleting their account must not erase the referrer's earned commission —
  the IronCoach lesson: ledger rows survive subject deletion).
- Add `unique` constraint on `profiles.referral_code` (currently enforced
  only by a check-then-insert race in `ensureReferralCode` — two concurrent
  code assignments could collide).

Confirm current RLS state on both tables as part of the introspection (the
existing admin routes read `referral_commissions` via the session-scoped
client, not service-role, so either RLS is off or a permissive policy
already exists) and document it in the migration's header comment — do not
change RLS behavior in this task.

### Task 2 — partner columns (`003_add_partner_columns.sql`)

- `profiles.is_partner boolean not null default false`
- `profiles.commission_rate numeric not null default 0.20`
- `profiles.commission_months int not null default 6`
- `referral_commissions.program text not null default 'friend' check (program in ('friend', 'partner'))`
- `referral_commissions.reversal_of uuid references referral_commissions(id)`
  (set on a refund-clawback row, pointing at the commission it reverses;
  nullable, no uniqueness constraint needed since a partial-refund path
  that could double-reverse is explicitly out of scope)

Backfill: existing `referral_commissions` rows get `program = 'friend'`
(the column default handles this automatically on insert; no existing rows
need updating since the column is new).

## Commission logic

### Task 3 — pure module (`src/lib/commission.ts`)

Extract the rate/window math out of the webhook into a dependency-free,
unit-testable module (mirrors the pattern used in a prior project's
RevenueCat commission module):

- `isWithinCommissionWindow(signupIso: string, months: number, nowIso: string): boolean`
  — `nowIso <= signupDate + months` (inclusive boundary).
- `computeCommission(amountPaidCents: number, rate: number): { grossUsd: number; commissionUsd: number }`
  — `grossUsd = amountPaidCents / 100`, `commissionUsd` rounded to cents via
  `Math.round(gross * rate * 100) / 100`.
- Tests cover: window boundary (exact N-months-later timestamp is still
  in-window; one day later is not), rate math at 0.20/12 and 0.20/6,
  zero/negative amount rejected.

### Task 4 — webhook: partner-aware `invoice.paid`

Replace the hardcoded `0.20` / 6-month check in
`src/app/api/stripe/webhook/route.ts`'s `invoice.paid` handler with a lookup
of the referrer's `commission_rate`/`commission_months`, passed through the
Task 3 module. Insert the `referral_commissions` row with
`program = referrer.is_partner ? 'partner' : 'friend'`. Existing idempotency
(`upsert` on `stripe_invoice_id`) and the 30-day `available_at` hold are
unchanged.

### Task 5 — webhook: `charge.refunded` clawback

New case in the webhook's event switch:

- Only act when the charge is **fully** refunded (`charge.amount_refunded >= charge.amount`).
- Resolve the original commission row via `charge.invoice` →
  `referral_commissions.stripe_invoice_id` (skip if the invoice was never
  commissioned — not every payer is referred).
- Skip if a reversal already exists for that row (`reversal_of` lookup) —
  idempotent against redelivery.
- Insert a new row: `commission_amount = -original.commission_amount`,
  `gross_amount = -original.gross_amount`, `program` inherited from the
  original, `reversal_of = original.id`, `status = 'pending'`,
  `available_at = now()` (no 30-day hold on a reversal — it should net
  against the next payout run immediately, regardless of whether the
  original commission was already paid out; the admin route's existing
  `status = 'pending'` aggregation picks it up and lets the payout go
  negative for that partner, which the admin resolves manually — cash
  already wired can't be un-sent by this system). `created_at` reflects
  the refund event's own timestamp, not the original invoice's.

## Referrer-facing correctness

### Task 6 — partner-aware `/api/referrals/me` and `ReferralsPage`

`ReferralsPage.tsx:48` hardcodes "Earn 20% of what your referrals pay for
their first 6 months" — once partners exist, a partner viewing their own
referrals page would see the wrong window. `GET /api/referrals/me`
additionally returns `commissionMonths` (read from the caller's own
`profiles.commission_months`); `ReferralsPage.tsx` renders that value in
place of the hardcoded "6" so both programs show correct copy on the same
shared page. No new page — this is a same-file, minimal-diff fix.

## Vanity codes and admin surface

### Task 7 — admin partner-management endpoint

`POST /api/referrals/admin/partners` (same `ADMIN_EMAILS` gate as the
existing admin routes): body `{ email, code }` — looks up the user by email
in `profiles`/`auth.users`, validates `code` against `^[a-z0-9-]{3,20}$`,
sets `is_partner = true`, `referral_code = code`, `commission_months = 12`
(rate stays at the 0.20 default — no per-partner custom-rate UI in v1).
Returns a friendly error on a duplicate code (unique-constraint violation
from Task 1) or unknown email.

### Task 8 — admin partners dashboard (`/admin/partners`)

New page alongside (not replacing) `/admin/referrals`:

- **Partner list**: table of `is_partner` profiles — code, signups
  (`referred_by` count), gross/commission totals, owed (pending +
  available, past the 30-day hold), paid to date.
- **Partner detail**: full `referral_commissions` ledger for that partner
  (including reversal rows), and a plain-text monthly statement block
  (entries + reversals + total) the admin copies into an email — same
  shape as the existing IronCoach dashboard design, but as a page in this
  Next.js app rather than a separately deployed app, since this app is
  already server-rendered and the admin already has a login here.
- **Create/edit partner form**: email lookup → assign vanity code (calls
  Task 6's endpoint).

Reuses the existing per-route `ADMIN_EMAILS` check pattern from
`/admin/referrals`'s API routes — no new auth mechanism.

## Testing

### Task 9 — end-to-end verification with Stripe CLI

Using `stripe trigger` against a local dev server (real signature
verification, not synthetic HTTP):

- `invoice.paid` for a partner referral, in-window → commission at 20%,
  `program = 'partner'`.
- `invoice.paid` for a partner referral, 13 months after signup →
  no commission written.
- `invoice.paid` for a friend referral → unchanged 20%/6-month behavior
  (regression check).
- `charge.refunded` (full) on a previously-commissioned partner invoice →
  negative reversal row, `reversal_of` set.
- Duplicate delivery of the same `invoice.paid` / `charge.refunded` event →
  no duplicate/double-reversal row.
- Admin partner-list rollup and statement text reflect all of the above
  correctly (signs, totals).

## Out of scope (v1)

Proportional clawback for partial refunds, per-partner custom commission
rates via UI (columns exist but no editing UI), a DB-backed `is_admin` role
or middleware-level admin gating (matches the existing `/admin/referrals`
pattern), partner-facing self-service portal, automated payouts or
statement emails, `?ref=` link generation changes (unchanged from the
existing friend-program links).
