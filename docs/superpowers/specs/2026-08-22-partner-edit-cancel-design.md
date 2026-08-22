# Partner Edit/Cancel — Design

**Date:** 2026-08-22
**Status:** Approved design, pending implementation plan

## Goal

Replace raw SQL as the only way to change or remove a partner. Add an edit
affordance to `/admin/partners` that lets the admin change a partner's
commission rate and commission window, or revert them back to normal/friend
status — without touching already-recorded commission rows.

## Context: what already exists

The partner-affiliate system (`docs/superpowers/specs/2026-08-21-partner-affiliate-system-design.md`,
merged) added:

- `profiles.is_partner`, `commission_rate` (fraction, default `0.20`),
  `commission_months` (default `6`, partners created at `12`) — set once at
  creation via `POST /api/referrals/admin/partners`, never editable after.
- `src/app/api/stripe/webhook/route.ts`'s `invoice.paid` handler reads
  `referrer.commission_rate`/`commission_months` **live** at write time (not
  snapshotted) and calls `isWithinCommissionWindow(payer.created_at, months, now)`
  (`src/lib/commission.ts`) — the window is **relative to each referred
  user's own signup date**, identical for friends and partners today.
- `GET /api/referrals/admin/partners/[id]/route.ts` returns one partner's
  profile fields + full `referral_commissions` ledger.
- `src/app/admin/partners/page.tsx` — a single-file admin page (own inline
  dark theme: hardcoded hex colors, not the app's `var(--...)` tokens used
  elsewhere) listing partners, expandable per-row to show the ledger, plus a
  create-partner form (email + vanity code).
- There is currently no UI or API path to change a partner's rate/window, or
  to un-flag one — only a direct SQL `UPDATE` against `profiles`.

There are currently **zero real partners** in production (`is_partner=false`
for both existing profiles, confirmed during the original build's Task 11
verification) — no backfill/migration concern for existing rows.

## Decisions (locked with owner)

1. **Commission window becomes an absolute calendar range for partners**,
   not a relative month count. Two new nullable `profiles` columns,
   `commission_window_start`/`commission_window_end`, hold it. This is a
   genuine behavior change from "N months after this referred user's
   signup" to "now falls within this partner's fixed date range" —
   explicitly requested, not a UI-only change.
2. **The friend track is completely unchanged**: friends keep using
   `commission_months` (fixed at `6`, never exposed to editing) and the
   existing signup-relative `isWithinCommissionWindow` check. Only
   `is_partner = true` profiles use the new absolute-window logic.
3. **New partner creation now sets an absolute window**, not
   `commission_months`: `commission_window_start = now`,
   `commission_window_end = now + 12 months`, editable immediately after via
   the new edit form.
4. **Un-flagging a partner resets them fully to friend defaults**:
   `is_partner=false, commission_rate=0.20, commission_months=6,
   commission_window_start=null, commission_window_end=null`. Their vanity
   `referral_code` is left untouched (preserves historical attribution links
   and existing ledger readability).
5. **Past commission rows are never touched.** `referral_commissions` rows
   are already immutable snapshots written once at invoice time (established
   in the original build); editing a partner's rate/window, or un-flagging
   them, only changes what the webhook computes for *future* events. No
   recomputation job exists or is added.
6. **UI stays inline on the existing list page** — a per-row "Edit" button
   toggling an inline form, matching the page's existing row-click-to-expand
   pattern rather than introducing a new page or a modal (this codebase has
   no modal precedent anywhere and no shared admin UI library).
7. **Date inputs are native `<input type="date">`**, not a new calendar
   library — consistent with the zero-dependency, hand-rolled-inline-style
   convention used throughout this page and `ReferralsPage.tsx`.
8. **Add a total-active-partners count** at the top of `/admin/partners` —
   just `partners.length` from the existing rollup response (already
   filtered to `is_partner=true`), no new query.

## Data model

### New migration — `005_add_partner_commission_window.sql`

- `profiles.commission_window_start timestamptz` (nullable)
- `profiles.commission_window_end timestamptz` (nullable)

No backfill needed (zero existing partners). `commission_months` and
`commission_rate` columns are unchanged and stay in place — `commission_months`
remains load-bearing for the friend track.

These two new columns are **not** added to migration 004's client-writable
grant list — like `is_partner`/`commission_rate`/`commission_months`, they
are only ever written via `adminClient()` (service-role) from the admin API
route below, never from a user's own session.

## Commission logic

### `src/lib/commission.ts` — new pure function

```
isWithinAbsoluteWindow(windowStart: string | null, windowEnd: string | null, nowIso: string): boolean
```

Returns `false` if either bound is `null` (no window means no eligibility —
never "always eligible" by default; matches "new partners get a window set
at creation" so this only matters for an edge case, not the common path).
Otherwise `true` iff `windowStart <= nowIso <= windowEnd` (inclusive both
ends, same inclusive convention as the existing relative-window function).

Unit tests (mirroring the existing `isWithinCommissionWindow` coverage):
inside range, before start, after end, exact boundary instants (inclusive),
both bounds null, one bound null.

### Webhook — `invoice.paid` branches on `is_partner`

`src/app/api/stripe/webhook/route.ts`'s existing referrer lookup
(`select('is_partner, commission_rate, commission_months')`) additionally
selects `commission_window_start, commission_window_end`. The eligibility
check becomes:

```
const eligible = referrer.is_partner
  ? isWithinAbsoluteWindow(referrer.commission_window_start, referrer.commission_window_end, now)
  : isWithinCommissionWindow(payer.created_at, referrer.commission_months, now)

if (!eligible) break
```

Everything else in the handler (idempotent `upsert` on `stripe_invoice_id`,
`computeCommission`, 30-day `available_at` hold, `program` tagging) is
unchanged.

## API

### `POST /api/referrals/admin/partners` (existing route — creation changes)

Replace `commission_months: 12` in the `.update(...)` call with:

```
commission_window_start: now.toISOString(),
commission_window_end: twelveMonthsFromNow.toISOString(), // same UTC-month arithmetic as isWithinCommissionWindow
```

(`commission_months` is left at its column default of `6` for a newly
partnered profile — harmless, since the webhook never reads
`commission_months` for a row where `is_partner=true`.)

### `PATCH /api/referrals/admin/partners/[id]` (new)

Same `ADMIN_EMAILS` gate as the existing `GET` on this route. Two mutually
exclusive request shapes:

**Edit terms** — `{ commission_rate: number, commission_window_start: string, commission_window_end: string }`
(all three required together; this is a full replace of a partner's terms,
not a partial patch, since a half-updated window is meaningless).
Validation, all 400 on failure:
- `0 < commission_rate <= 1`
- both dates parse as valid ISO instants
- `commission_window_end > commission_window_start`
- target profile exists and `is_partner = true` (404 otherwise — editing
  terms on a non-partner is not a valid action, use the remove/create flow
  instead)

**Remove partner** — `{ is_partner: false }` (no other keys inspected).
Server-side, unconditionally sets:
```
is_partner: false,
commission_rate: 0.20,
commission_months: 6,
commission_window_start: null,
commission_window_end: null,
```
`referral_code` is not touched. Succeeds even if the profile is already a
non-partner (idempotent no-op-ish reset) — simpler than special-casing, and
harmless since the reset values equal the friend defaults either way.

Both shapes go through `adminClient()` (service-role) — same reasoning as
every other write to these columns since migration 004.

## UI (`src/app/admin/partners/page.tsx`)

- Top of page: `{partners.length} active partner{s}` line, near the existing
  heading/subtext. The subtext's hardcoded "20% for 12 months (vs. the
  standard 6-month friend program)" copy is updated to reflect that terms
  are now per-partner instead of fixed.
- Each partner row gets an "Edit" button next to (not replacing) the
  existing click-to-expand-ledger row click — the button stops event
  propagation so it doesn't also toggle the ledger.
- Clicking "Edit" toggles an inline form below that row (sibling to the
  ledger table, same inline-style convention as the rest of the file):
  - Number input for rate, displayed/edited as a 0–100 percentage
    (`Math.round(p.rate * 100)` on open, converted back to a 0–1 fraction
    on submit)
  - Two `<input type="date">` fields, pre-filled from
    `commission_window_start`/`commission_window_end` (added to the `GET
    /partners` and `GET /partners/[id]` response `select(...)` lists)
  - "Save changes" → `PATCH` with the edit-terms shape, then reloads the
    partner list
  - "Remove partner" (visually distinct/danger styling, native `confirm()`
    guard given this codebase has no custom dialog component) → `PATCH`
    with `{ is_partner: false }`, then reloads the partner list and closes
    the row if it was expanded
  - "Cancel" closes the form without saving

## Testing

- `commission.test.ts`: new test cases for `isWithinAbsoluteWindow` (see
  above).
- Manual/API-level check (no live Stripe event needed — this only changes
  which fields are read, not the webhook's event-parsing): update a test
  partner's window to a past range, confirm a fresh `invoice.paid` trigger
  produces no commission row; update to a range spanning now, confirm it
  does; confirm an existing (pre-edit) `referral_commissions` row is
  byte-for-byte unchanged after an edit.
- Manual admin-UI click-through: edit rate, edit window, remove a partner,
  re-create the same email as a partner afterward (confirms un-flagging
  doesn't leave the account in a broken state for re-assignment).

## Out of scope

Bulk edit, an audit log of who changed a partner's terms and when,
recomputing/adjusting past commission rows when terms change, editing a
friend's terms (friends stay fixed at 20%/6mo by design), a "pause" state
distinct from full removal, validation preventing a window edit that would
retroactively make already-*written* commissions look wrong in hindsight
(not possible to violate, since past rows are immutable and never
recomputed).
