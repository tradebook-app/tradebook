# Partner Edit/Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw-SQL partner management with an admin UI on `/admin/partners` for editing a partner's commission rate and absolute commission-eligibility date range, or reverting them to normal/friend status.

**Architecture:** Two new nullable `profiles` columns (`commission_window_start`/`commission_window_end`) hold an absolute calendar range for partners only; the friend track keeps its existing relative-months model unchanged. The Stripe webhook branches on `is_partner` to pick which eligibility check to run. A new `PATCH /api/referrals/admin/partners/[id]` endpoint handles both "edit terms" and "revert to friend" in one route, called from a new inline edit form on the existing admin page.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + service-role client), Stripe webhooks, Vitest.

## Global Constraints

- `ADMIN_EMAILS` env-var allowlist is the only admin gate — no DB-backed role, no middleware. Every new/modified route checks it exactly like the existing routes do.
- `commission_rate` is stored and transmitted as a fraction (`0 < rate <= 1`), never a 0-100 integer — only the UI layer converts for display/input.
- All writes to `is_partner`, `commission_rate`, `commission_months`, `commission_window_start`, `commission_window_end` go through `adminClient()` (service-role) — these columns are not in migration 004's client-writable grant list and a session-scoped write would fail with a permission error.
- The friend track (`commission_months`, relative-to-signup-date window) is never touched by this feature — only `is_partner = true` profiles use the new absolute-window columns/logic.
- `referral_commissions` rows are immutable once written — no task in this plan recomputes or edits an existing ledger row when a partner's terms change.
- Window/date boundaries are inclusive on both ends, matching the existing `isWithinCommissionWindow` convention.
- No new UI dependency — date inputs use native `<input type="date">`, matching this codebase's zero-component-library convention.

---

## File Structure

| File | Change |
|---|---|
| `supabase/migrations/005_add_partner_commission_window.sql` | Create — adds the two new columns |
| `src/lib/types.ts` | Modify — `ProfileRow` gains the two new fields |
| `src/lib/commission.ts` | Modify — add `isWithinAbsoluteWindow` |
| `src/lib/commission.test.ts` | Modify — tests for the new function |
| `src/app/api/stripe/webhook/route.ts` | Modify — `invoice.paid` branches on `is_partner` |
| `src/app/api/referrals/admin/partners/route.ts` | Modify — `POST` sets a window instead of `commission_months`; `GET` exposes the new fields |
| `src/app/api/referrals/admin/partners/[id]/route.ts` | Modify — `GET` exposes the new fields; add `PATCH` |
| `src/app/admin/partners/page.tsx` | Modify — active-partner count, per-row Edit form, Remove action |

---

### Task 1: Database migration + type update

**Files:**
- Create: `supabase/migrations/005_add_partner_commission_window.sql`
- Modify: `src/lib/types.ts:358-361`

**Interfaces:**
- Produces: `profiles.commission_window_start` / `profiles.commission_window_end` (nullable `timestamptz` columns); `ProfileRow.commission_window_start: string | null`, `ProfileRow.commission_window_end: string | null`.

- [ ] **Step 1: Write the migration file**

```sql
-- Adds an absolute commission-eligibility date range for partners, replacing
-- the relative "N months after this referred user's signup" model for the
-- partner track only. The friend track (profiles.commission_months) is
-- unchanged -- see docs/superpowers/specs/2026-08-22-partner-edit-cancel-design.md.
--
-- Both columns are nullable: null means "no window set, not eligible" (see
-- isWithinAbsoluteWindow in src/lib/commission.ts), not "always eligible".
-- New partners get a window set at creation time by
-- POST /api/referrals/admin/partners; there are zero existing partner rows
-- to backfill as of this migration.
--
-- Like is_partner/commission_rate/commission_months, these columns are never
-- client-writable -- not added to migration 004's grant list. All writes go
-- through adminClient() from the admin partner routes.

alter table public.profiles
  add column commission_window_start timestamptz,
  add column commission_window_end timestamptz;
```

- [ ] **Step 2: Apply the migration to the live database**

Use the Supabase MCP `apply_migration` tool with `name: "add_partner_commission_window"` and the SQL body above (same tool/pattern used for migrations 002-004 in this project).

- [ ] **Step 3: Verify the columns exist**

Use the Supabase MCP `execute_sql` tool:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'profiles'
  and column_name in ('commission_window_start', 'commission_window_end');
```

Expected: 2 rows, both `data_type = 'timestamp with time zone'`, both `is_nullable = 'YES'`.

- [ ] **Step 4: Update the `ProfileRow` type**

In `src/lib/types.ts`, change:

```ts
  is_partner: boolean
  commission_rate: number
  commission_months: number
}
```

to:

```ts
  is_partner: boolean
  commission_rate: number
  commission_months: number
  commission_window_start: string | null
  commission_window_end: string | null
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (pre-existing errors, if any, are unrelated to this change — only check that nothing new appears referencing `profiles` or `ProfileRow`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/005_add_partner_commission_window.sql src/lib/types.ts
git commit -m "feat: add absolute commission window columns to profiles"
```

---

### Task 2: `isWithinAbsoluteWindow` pure function

**Files:**
- Modify: `src/lib/commission.ts`
- Test: `src/lib/commission.test.ts`

**Interfaces:**
- Consumes: nothing new (pure function, no dependencies, matches the existing `isWithinCommissionWindow` style in the same file).
- Produces: `isWithinAbsoluteWindow(windowStart: string | null, windowEnd: string | null, nowIso: string): boolean`, imported by Task 3's webhook change.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/commission.test.ts` (new `describe` block, after the existing `isWithinCommissionWindow` block):

```ts
describe('isWithinAbsoluteWindow', () => {
  it('is true when now falls inside the window', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2026-06-15T00:00:00.000Z')).toBe(true)
  })
  it('is true on the exact start boundary (inclusive)', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(true)
  })
  it('is true on the exact end boundary (inclusive)', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2026-12-31T00:00:00.000Z')).toBe(true)
  })
  it('is false before the window starts', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2025-12-31T23:59:59.999Z')).toBe(false)
  })
  it('is false after the window ends', () => {
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2027-01-01T00:00:00.000Z')).toBe(false)
  })
  it('is false when either or both bounds are null', () => {
    expect(isWithinAbsoluteWindow(null, '2026-12-31T00:00:00.000Z', '2026-06-15T00:00:00.000Z')).toBe(false)
    expect(isWithinAbsoluteWindow('2026-01-01T00:00:00.000Z', null, '2026-06-15T00:00:00.000Z')).toBe(false)
    expect(isWithinAbsoluteWindow(null, null, '2026-06-15T00:00:00.000Z')).toBe(false)
  })
})
```

Also update the import line at the top of the file:

```ts
import { computeCommission, isWithinAbsoluteWindow, isWithinCommissionWindow } from './commission'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- commission.test.ts`
Expected: FAIL — `isWithinAbsoluteWindow is not a function` (or a TypeScript import error).

- [ ] **Step 3: Implement the function**

Add to `src/lib/commission.ts`, after `isWithinCommissionWindow`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- commission.test.ts`
Expected: PASS — all tests including the pre-existing `isWithinCommissionWindow`/`computeCommission` suites.

- [ ] **Step 5: Commit**

```bash
git add src/lib/commission.ts src/lib/commission.test.ts
git commit -m "feat: add isWithinAbsoluteWindow for partner commission eligibility"
```

---

### Task 3: Webhook — partner-aware `invoice.paid` eligibility

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts:3` (import), `:174-189` (referrer lookup + eligibility check)

**Interfaces:**
- Consumes: `isWithinAbsoluteWindow` from Task 2 (`src/lib/commission.ts`).
- Produces: no new exports — this task only changes internal branching in an existing handler.

- [ ] **Step 1: Update the import**

Change:

```ts
import { computeCommission, isWithinCommissionWindow } from '@/lib/commission'
```

to:

```ts
import { computeCommission, isWithinAbsoluteWindow, isWithinCommissionWindow } from '@/lib/commission'
```

- [ ] **Step 2: Select the new columns and branch the eligibility check**

Change:

```ts
        const { data: referrer, error: referrerErr } = await supabase
          .from('profiles')
          .select('is_partner, commission_rate, commission_months')
          .eq('id', payer.referred_by)
          .maybeSingle()

        if (referrerErr) {
          console.error('invoice.paid: failed to look up referrer', payer.referred_by, referrerErr)
          return NextResponse.json({ error: 'Failed to look up referrer' }, { status: 500 })
        }

        if (!referrer) break // referrer account no longer exists

        if (!isWithinCommissionWindow(payer.created_at, referrer.commission_months, new Date().toISOString())) {
          break // outside this referrer's earning window
        }
```

to:

```ts
        const { data: referrer, error: referrerErr } = await supabase
          .from('profiles')
          .select('is_partner, commission_rate, commission_months, commission_window_start, commission_window_end')
          .eq('id', payer.referred_by)
          .maybeSingle()

        if (referrerErr) {
          console.error('invoice.paid: failed to look up referrer', payer.referred_by, referrerErr)
          return NextResponse.json({ error: 'Failed to look up referrer' }, { status: 500 })
        }

        if (!referrer) break // referrer account no longer exists

        const nowIso = new Date().toISOString()
        // Partners use an absolute admin-set date range; friends keep the
        // existing relative-to-signup-date window, unchanged.
        const eligible = referrer.is_partner
          ? isWithinAbsoluteWindow(referrer.commission_window_start, referrer.commission_window_end, nowIso)
          : isWithinCommissionWindow(payer.created_at, referrer.commission_months, nowIso)

        if (!eligible) break // outside this referrer's earning window
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

There is no existing unit-test harness for this webhook route in this codebase (only pure functions in `src/lib/` are unit-tested; the route itself was previously verified live via Stripe CLI). This task's behavioral correctness — that partner and friend referrals both compute commissions correctly under the new branch — is verified end-to-end in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: webhook uses absolute date window for partner commission eligibility"
```

---

### Task 4: Admin partner API — creation window, GET field exposure, PATCH edit/remove

**Files:**
- Modify: `src/app/api/referrals/admin/partners/route.ts:50-53` (POST), `:84-129` (GET)
- Modify: `src/app/api/referrals/admin/partners/[id]/route.ts:24-29` (GET), add `PATCH`

**Interfaces:**
- Consumes: `adminClient()` from `src/lib/referrals.ts` (existing).
- Produces: `PATCH /api/referrals/admin/partners/[id]` — request body `{ commission_rate: number, commission_window_start: string, commission_window_end: string }` (edit) or `{ is_partner: false }` (remove); response `{ ok: true }` or `{ error: string }`. `GET /api/referrals/admin/partners` and `GET /api/referrals/admin/partners/[id]` responses gain `windowStart: string | null` / `windowEnd: string | null` per partner. Consumed by Task 5's UI.

- [ ] **Step 1: Change partner creation to set a window instead of `commission_months`**

In `src/app/api/referrals/admin/partners/route.ts`, change:

```ts
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ is_partner: true, referral_code: normalizedCode, commission_months: 12 })
    .eq('id', target.id)
```

to:

```ts
  const windowStart = new Date()
  const windowEnd = new Date(windowStart)
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + 12) // same UTC-month arithmetic as isWithinCommissionWindow

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      is_partner: true,
      referral_code: normalizedCode,
      commission_window_start: windowStart.toISOString(),
      commission_window_end: windowEnd.toISOString(),
    })
    .eq('id', target.id)
```

- [ ] **Step 2: Expose the new fields from the partner rollup `GET`**

In the same file, change:

```ts
  const { data: partners } = await admin
    .from('profiles')
    .select('id, first_name, referral_code, commission_rate, commission_months')
    .eq('is_partner', true)
```

to:

```ts
  const { data: partners } = await admin
    .from('profiles')
    .select('id, first_name, referral_code, commission_rate, commission_months, commission_window_start, commission_window_end')
    .eq('is_partner', true)
```

and change the `result` mapping's returned object:

```ts
    return {
      id: p.id,
      name: p.first_name || 'Unknown',
      code: p.referral_code,
      rate: p.commission_rate,
      months: p.commission_months,
      signups,
      grossTotal,
      commissionTotal,
      owed,
      paid,
    }
```

to:

```ts
    return {
      id: p.id,
      name: p.first_name || 'Unknown',
      code: p.referral_code,
      rate: p.commission_rate,
      months: p.commission_months,
      windowStart: p.commission_window_start,
      windowEnd: p.commission_window_end,
      signups,
      grossTotal,
      commissionTotal,
      owed,
      paid,
    }
```

- [ ] **Step 3: Expose the new fields from the per-partner `GET`**

In `src/app/api/referrals/admin/partners/[id]/route.ts`, change:

```ts
  const { data: partner } = await admin
    .from('profiles')
    .select('id, first_name, referral_code, commission_rate, commission_months')
    .eq('id', params.id)
    .eq('is_partner', true)
    .maybeSingle()
```

to:

```ts
  const { data: partner } = await admin
    .from('profiles')
    .select('id, first_name, referral_code, commission_rate, commission_months, commission_window_start, commission_window_end')
    .eq('id', params.id)
    .eq('is_partner', true)
    .maybeSingle()
```

- [ ] **Step 4: Add the `PATCH` handler**

In the same file (`src/app/api/referrals/admin/partners/[id]/route.ts`), add after the `GET` function:

```ts
// Edits a partner's rate/window, or reverts them to normal/friend status.
// Two mutually exclusive request shapes -- see docs/superpowers/specs/
// 2026-08-22-partner-edit-cancel-design.md. Uses adminClient() like GET
// above, for the same reason: these columns aren't client-writable
// (migration 004) and referral_commissions/profiles RLS would otherwise
// block or misscope this admin-only write.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const admin = adminClient()

  // Remove-partner shape: reset every partner-specific column back to the
  // standard friend defaults. referral_code is left alone -- it preserves
  // historical attribution links and past ledger readability.
  if (body.is_partner === false) {
    const { error } = await admin
      .from('profiles')
      .update({
        is_partner: false,
        commission_rate: 0.20,
        commission_months: 6,
        commission_window_start: null,
        commission_window_end: null,
      })
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Edit-terms shape: full replace of rate + window (not a partial patch --
  // a half-updated window is meaningless).
  const { commission_rate, commission_window_start, commission_window_end } = body
  if (
    typeof commission_rate !== 'number' || !(commission_rate > 0 && commission_rate <= 1) ||
    typeof commission_window_start !== 'string' || typeof commission_window_end !== 'string'
  ) {
    return NextResponse.json(
      { error: 'commission_rate (0-1), commission_window_start, and commission_window_end are all required' },
      { status: 400 }
    )
  }

  const start = new Date(commission_window_start)
  const end = new Date(commission_window_end)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }
  if (end.getTime() <= start.getTime()) {
    return NextResponse.json({ error: 'commission_window_end must be after commission_window_start' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', params.id)
    .eq('is_partner', true)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      commission_rate,
      commission_window_start: start.toISOString(),
      commission_window_end: end.toISOString(),
    })
    .eq('id', params.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/referrals/admin/partners/route.ts src/app/api/referrals/admin/partners/[id]/route.ts
git commit -m "feat: add PATCH endpoint for editing/removing a partner"
```

---

### Task 5: Admin UI — active count, edit form, remove action

**Files:**
- Modify: `src/app/admin/partners/page.tsx`

**Interfaces:**
- Consumes: `GET /api/referrals/admin/partners` (now returns `windowStart`/`windowEnd` per Task 4), `PATCH /api/referrals/admin/partners/[id]` (Task 4).
- Produces: nothing consumed elsewhere — this is the top-level page.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/app/admin/partners/page.tsx` with:

```tsx
'use client'

import { useState, useEffect } from 'react'

type Partner = {
  id: string
  name: string
  code: string | null
  rate: number
  months: number
  windowStart: string | null
  windowEnd: string | null
  signups: number
  grossTotal: number
  commissionTotal: number
  owed: number
  paid: number
}

type LedgerRow = {
  id: string
  stripe_invoice_id: string
  gross_amount: number
  commission_amount: number
  status: string
  program: string
  reversal_of: string | null
  available_at: string
  paid_at: string | null
  created_at: string
}

// Converts a stored ISO instant to the yyyy-mm-dd shape <input type="date"> expects.
function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [formMessage, setFormMessage] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRate, setEditRate] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  function loadPartners() {
    setError(null)
    fetch('/api/referrals/admin/partners')
      .then(async r => {
        if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Failed to load') }
        return r.json()
      })
      .then(json => setPartners(json.partners))
      .catch(err => setError(err.message))
  }

  useEffect(() => { loadPartners() }, [])

  useEffect(() => {
    if (!selected) { setLedger(null); return }
    fetch(`/api/referrals/admin/partners/${selected}`)
      .then(r => r.json())
      .then(json => setLedger(json.ledger))
  }, [selected])

  async function createPartner(e: React.FormEvent) {
    e.preventDefault()
    setFormMessage(null)
    const res = await fetch('/api/referrals/admin/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const json = await res.json()
    if (!res.ok) {
      setFormMessage(json.error || 'Failed to create partner')
      return
    }
    setFormMessage(`${email} is now a partner with code "${json.code}".`)
    setEmail('')
    setCode('')
    loadPartners()
  }

  function openEdit(p: Partner, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(p.id)
    setEditRate(String(Math.round(p.rate * 100)))
    setEditStart(toDateInputValue(p.windowStart))
    setEditEnd(toDateInputValue(p.windowEnd))
    setEditError(null)
  }

  function closeEdit(e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditError(null)
    const ratePct = Number(editRate)
    if (!editStart || !editEnd || Number.isNaN(ratePct) || ratePct <= 0 || ratePct > 100) {
      setEditError('Enter a rate between 1-100 and both dates.')
      return
    }
    setEditSaving(true)
    const res = await fetch(`/api/referrals/admin/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commission_rate: ratePct / 100,
        commission_window_start: `${editStart}T00:00:00.000Z`,
        commission_window_end: `${editEnd}T23:59:59.999Z`,
      }),
    })
    const json = await res.json()
    setEditSaving(false)
    if (!res.ok) {
      setEditError(json.error || 'Failed to save changes')
      return
    }
    setEditingId(null)
    loadPartners()
  }

  async function removePartner(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Remove this partner? They revert to standard friend terms (20% for 6 months on future referrals). Their vanity code and past commissions are kept.')) {
      return
    }
    setEditSaving(true)
    const res = await fetch(`/api/referrals/admin/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_partner: false }),
    })
    setEditSaving(false)
    if (!res.ok) {
      const json = await res.json()
      setEditError(json.error || 'Failed to remove partner')
      return
    }
    setEditingId(null)
    if (selected === id) setSelected(null)
    loadPartners()
  }

  const usd = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D11', color: '#fff', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Affiliate Partners</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
          Partners earn a custom rate for a custom date range, set per-partner below (vs. the standard 20%/6-month friend program).
        </p>
        {partners && (
          <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '18px' }}>
            {partners.length} active partner{partners.length === 1 ? '' : 's'}
          </p>
        )}

        <form onSubmit={createPartner} style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            placeholder="Partner's account email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ flex: 1, minWidth: '220px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
          />
          <input
            placeholder="vanity-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            style={{ width: '160px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
          />
          <button type="submit" style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>
            Assign partner
          </button>
        </form>
        {formMessage && <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '24px' }}>{formMessage}</div>}

        {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>Error: {error}</div>}

        {!partners ? (
          <div style={{ color: '#888', fontSize: '13px' }}>Loading...</div>
        ) : partners.length === 0 ? (
          <div style={{ color: '#888', fontSize: '13px' }}>No partners yet.</div>
        ) : (
          <div style={{ border: '1px solid #222', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
            {partners.map(p => (
              <div
                key={p.id}
                onClick={() => setSelected(p.id === selected ? null : p.id)}
                style={{ padding: '16px 20px', borderBottom: '1px solid #222', cursor: 'pointer', background: selected === p.id ? '#15151a' : 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.name} — {p.code}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      {p.signups} signups &middot; {(p.rate * 100).toFixed(0)}%
                      {p.windowStart && p.windowEnd
                        ? ` from ${new Date(p.windowStart).toLocaleDateString()} to ${new Date(p.windowEnd).toLocaleDateString()}`
                        : ' (no window set)'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700 }}>Owed {usd(p.owed)}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>Paid {usd(p.paid)} &middot; Gross {usd(p.grossTotal)}</div>
                    </div>
                    <button
                      onClick={e => openEdit(p, e)}
                      style={{ background: '#1a1a1f', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {editingId === p.id && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ marginTop: '14px', padding: '14px', background: '#0a0a0d', border: '1px solid #222', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>
                        Rate %
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={editRate}
                          onChange={e => setEditRate(e.target.value)}
                          style={{ display: 'block', width: '80px', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                        />
                      </label>
                      <label style={{ fontSize: '11px', color: '#888' }}>
                        Start date
                        <input
                          type="date"
                          value={editStart}
                          onChange={e => setEditStart(e.target.value)}
                          style={{ display: 'block', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                        />
                      </label>
                      <label style={{ fontSize: '11px', color: '#888' }}>
                        End date
                        <input
                          type="date"
                          value={editEnd}
                          onChange={e => setEditEnd(e.target.value)}
                          style={{ display: 'block', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                        />
                      </label>
                    </div>
                    {editError && <div style={{ color: '#ef4444', fontSize: '12px' }}>{editError}</div>}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        disabled={editSaving}
                        onClick={e => saveEdit(p.id, e)}
                        style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Save changes
                      </button>
                      <button
                        onClick={closeEdit}
                        style={{ background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={editSaving}
                        onClick={e => removePartner(p.id, e)}
                        style={{ marginLeft: 'auto', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Remove partner
                      </button>
                    </div>
                  </div>
                )}

                {selected === p.id && ledger && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #222' }}>
                        <th style={{ textAlign: 'left', padding: '8px', color: '#888' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '8px', color: '#888' }}>Program</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Gross</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Commission</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                          <td style={{ padding: '8px' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '8px' }}>{row.program}{row.reversal_of ? ' (refund)' : ''}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{usd(row.gross_amount)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{usd(row.commission_amount)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/partners/page.tsx
git commit -m "feat: add partner edit/remove UI and active-partner count"
```

---

### Task 6: End-to-end verification with Stripe CLI + admin UI click-through

**Files:** none (verification only — no code changes)

**Interfaces:**
- Consumes: everything from Tasks 1-5.

This reuses the exact working method and the exact two real profiles established in the original build's Task 11 (`.superpowers/sdd/task-11-report.md`) — there are only 2 real profiles in this production database:
- Profile A (partner-under-test): `id = a1a6b7d8-0f46-42d1-974c-b88554c6dd75`, `vermonski@gmail.com`
- Profile B (referred-user-under-test): `id = ef89c11d-564e-4851-b3a2-83be00414221`, `benyassgroup+test4@gmail.com`, already has `referred_by = A` as genuine pre-existing data — do not change this field.

- [ ] **Step 1: Safety check**

Confirm `STRIPE_SECRET_KEY` in `.env.local` starts with `sk_test_` (never print the full key). Confirm `stripe --version` runs.

- [ ] **Step 2: Capture current values for profiles A and B**

Via Supabase MCP `execute_sql`:

```sql
select id, is_partner, referral_code, commission_rate, commission_months,
       commission_window_start, commission_window_end, stripe_customer_id, referred_by
from profiles
where id in ('a1a6b7d8-0f46-42d1-974c-b88554c6dd75', 'ef89c11d-564e-4851-b3a2-83be00414221');
```

Save this output verbatim — Step 15 restores these exact values.

- [ ] **Step 3: Ensure `ADMIN_EMAILS` is set for the UI check**

Check `.env.local` for `ADMIN_EMAILS`. If missing or doesn't include `vermonski@gmail.com`, add `ADMIN_EMAILS=vermonski@gmail.com` and note that this line did not exist before (so Step 15 can remove it again).

- [ ] **Step 4: Start the dev server and Stripe listener**

Start as background processes:
```bash
npm run dev
```
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook --print-json
```
Capture the printed webhook signing secret. If `STRIPE_WEBHOOK_SECRET` isn't already in `.env.local`, append it and restart the dev server (note whether you added this line, for Step 15).

- [ ] **Step 5: Seed profile A as a partner with an in-window range**

```sql
update profiles
set is_partner = true,
    referral_code = 'e2e-window-test',
    commission_rate = 0.20,
    commission_window_start = now() - interval '1 day',
    commission_window_end = now() + interval '30 days'
where id = 'a1a6b7d8-0f46-42d1-974c-b88554c6dd75';
```

- [ ] **Step 6: Fire the first `invoice.paid` trigger**

Run: `stripe trigger invoice.paid`
From the `stripe listen` output, capture `EVENT_ID_1`, `CUSTOMER_ID_1`, `INVOICE_ID_1`, `AMOUNT_PAID_CENTS_1`. First delivery is expected to no-op (200 OK, no commission row) since B isn't pointed at `CUSTOMER_ID_1` yet.

- [ ] **Step 7: Point B at the new customer and redeliver**

```sql
update profiles set stripe_customer_id = '<CUSTOMER_ID_1>' where id = 'ef89c11d-564e-4851-b3a2-83be00414221';
```
Run: `stripe events resend <EVENT_ID_1>`

- [ ] **Step 8: Verify the in-window commission was written**

```sql
select gross_amount, commission_amount, program, status
from referral_commissions
where stripe_invoice_id = '<INVOICE_ID_1>';
```
Expected: exactly 1 row, `program = 'partner'`, `commission_amount = 0.20 * gross_amount`.

- [ ] **Step 9: Move the window into the past and fire a second, independent trigger**

```sql
update profiles
set commission_window_end = now() - interval '1 day'
where id = 'a1a6b7d8-0f46-42d1-974c-b88554c6dd75';
```
Run: `stripe trigger invoice.paid`, capture `EVENT_ID_2`, `CUSTOMER_ID_2`, `INVOICE_ID_2`.
```sql
update profiles set stripe_customer_id = '<CUSTOMER_ID_2>' where id = 'ef89c11d-564e-4851-b3a2-83be00414221';
```
Run: `stripe events resend <EVENT_ID_2>`

- [ ] **Step 10: Verify no commission was written for the expired window**

```sql
select count(*) from referral_commissions where stripe_invoice_id = '<INVOICE_ID_2>';
```
Expected: `0`.

- [ ] **Step 11: Regression-check the friend track is unaffected**

```sql
update profiles set is_partner = false where id = 'a1a6b7d8-0f46-42d1-974c-b88554c6dd75';
```
Run: `stripe trigger invoice.paid`, capture `EVENT_ID_3`, `CUSTOMER_ID_3`, `INVOICE_ID_3`.
```sql
update profiles set stripe_customer_id = '<CUSTOMER_ID_3>' where id = 'ef89c11d-564e-4851-b3a2-83be00414221';
```
Run: `stripe events resend <EVENT_ID_3>`
```sql
select gross_amount, commission_amount, program, status
from referral_commissions
where stripe_invoice_id = '<INVOICE_ID_3>';
```
Expected: exactly 1 row, `program = 'friend'`, `commission_amount = 0.20 * gross_amount` (unchanged friend behavior).

- [ ] **Step 12: Re-seed A as a partner for the UI click-through**

```sql
update profiles
set is_partner = true,
    referral_code = 'e2e-window-test',
    commission_rate = 0.20,
    commission_window_start = now() - interval '1 day',
    commission_window_end = now() + interval '30 days'
where id = 'a1a6b7d8-0f46-42d1-974c-b88554c6dd75';
```

- [ ] **Step 13: Click through the admin UI**

Sign in as `vermonski@gmail.com`, visit `/admin/partners`. Confirm:
- The active-partner count reads "1 active partner".
- The row shows `e2e-window-test`, 20%, and a from/to date range matching the seeded window.

Click "Edit" on the row. Confirm the form pre-fills rate=20 and the correct start/end dates. Change the rate to 25 and shift the end date out by a few days. Click "Save changes". Confirm the row's displayed rate/dates update to match, and verify in the database:

```sql
select commission_rate, commission_window_start, commission_window_end
from profiles where id = 'a1a6b7d8-0f46-42d1-974c-b88554c6dd75';
```

Click "Edit" again, then "Remove partner", confirm the browser `confirm()` dialog. Confirm the row disappears and the count reads "0 active partners". Verify in the database:

```sql
select is_partner, commission_rate, commission_months, commission_window_start, commission_window_end, referral_code
from profiles where id = 'a1a6b7d8-0f46-42d1-974c-b88554c6dd75';
```
Expected: `is_partner=false, commission_rate=0.20, commission_months=6, commission_window_start=null, commission_window_end=null`, `referral_code` still `'e2e-window-test'` (preserved, not nulled).

- [ ] **Step 14: Clean up seeded ledger rows**

```sql
delete from referral_commissions where stripe_invoice_id in ('<INVOICE_ID_1>', '<INVOICE_ID_2>', '<INVOICE_ID_3>');
```

- [ ] **Step 15: Restore profiles A and B, revert env changes, stop processes**

Restore A and B to the exact values captured in Step 2 (all columns, including `is_partner`, `referral_code`, `commission_rate`, `commission_months`, `commission_window_start`, `commission_window_end`, `stripe_customer_id`). Confirm:

```sql
select count(*) from referral_commissions
where referrer_id in ('a1a6b7d8-0f46-42d1-974c-b88554c6dd75', 'ef89c11d-564e-4851-b3a2-83be00414221');
```
Expected: matches the pre-test count from Step 2's context (0, per the original build's last confirmed state).

If `ADMIN_EMAILS` or `STRIPE_WEBHOOK_SECRET` were added to `.env.local` in Steps 3-4 and didn't exist before, remove them. Stop the `npm run dev` and `stripe listen` background processes (check for orphaned `node` processes on port 3000/3001 and kill them if the task-stop didn't reach them, as happened during the original Task 11).

---

## Self-Review

**Spec coverage:** Editable rate (Task 4/5) ✓. Absolute start/end date range replacing months (Tasks 1-5) ✓. Un-flag/remove option (Task 4 PATCH + Task 5 UI) ✓. Past commission records unaffected (architectural — immutable ledger rows, verified explicitly in Task 6 Step 8/10/11 that only future eligibility changes, never past rows) ✓. Consistent admin dashboard look (Task 5 reuses the exact existing inline-style/row-expand pattern) ✓. Active-partner count (Task 5) ✓.

**Placeholder scan:** none found — every step has literal code, exact SQL, or exact commands.

**Type consistency:** `isWithinAbsoluteWindow(windowStart: string | null, windowEnd: string | null, nowIso: string): boolean` — same signature used in Task 2's definition, Task 2's tests, and Task 3's webhook call site. `Partner` type's `windowStart`/`windowEnd` fields match the exact keys Task 4 Step 2 adds to the `GET /partners` response mapping. `PATCH` request body shapes in Task 4 Step 4 match exactly what Task 5's `saveEdit`/`removePartner` send.
