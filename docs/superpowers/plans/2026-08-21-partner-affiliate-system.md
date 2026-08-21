# Partner Affiliate System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-managed partner/affiliate track (vanity codes, 20%-for-12-months recurring commission, refund clawback) alongside Sleektrade's existing friend-referral program, sharing one commission ledger, plus an admin dashboard for managing partners.

**Architecture:** Extend the existing `profiles`/`referral_commissions` tables in place (after committing their never-migrated live schema) with a `program` discriminator and per-referrer rate/window columns; extract the commission math into a pure, unit-tested module; extend the Stripe webhook's `invoice.paid` handler to read per-referrer rate/window and add a new `charge.refunded` handler for clawback; add an admin partner-management endpoint and dashboard page reusing the existing `ADMIN_EMAILS` gate pattern.

**Tech Stack:** Next.js 14 (App Router) + TypeScript, Supabase (Postgres + `@supabase/supabase-js`), Stripe (`stripe` v22, API version `2024-04-10`), Vitest (new — no test framework exists in this repo yet).

**Spec:** `docs/superpowers/specs/2026-08-21-partner-affiliate-system-design.md` — read it first.

## Global Constraints

- Commission rate default: **0.20** (`profiles.commission_rate`, numeric).
- Commission window: **6 months** default (friend), **12 months** for partners (`profiles.commission_months`, int).
- Vanity code format: `^[a-z0-9-]{3,20}$` after `.trim().toLowerCase()`.
- Refund handling: **full refunds only** (`charge.amount_refunded >= charge.amount`); partial-refund proportional clawback is out of scope.
- Ledger currency: USD only. Amounts stored as `numeric`, matching existing `gross_amount`/`commission_amount` columns.
- Admin gate: reuse the existing pattern verbatim —
  `const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)`
  then `if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return 403`. No DB `is_admin` role, no middleware-level admin gating (matches the existing `/admin/referrals` route, which also has none).
- New admin routes that need to read/write an **arbitrary** user's `profiles` row (not the caller's own) MUST use a service-role client (`createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`), matching the existing `adminClient()` pattern in `src/lib/referrals.ts:62-67`. Never assume RLS will block or allow this — it's independent of whatever Task 1 finds.
- Rate/months are read live from the referrer's `profiles` row at write time — never snapshotted onto a `referral_commissions` row.
- Migrations are applied with the Supabase MCP `apply_migration` tool AND saved as files under `supabase/migrations/`, following the existing numeric-prefix naming (`00N_description.sql`).
- Commit message style: short, imperative, optionally prefixed with an area (`db:`, `webhook:`, `admin:`) — matches this repo's existing casual commit history.
- All new/changed files must pass `npx tsc --noEmit` from the repo root (existing `tsconfig.json`, `strict: false` — don't introduce stricter typing than the rest of the codebase uses).

## Execution prerequisites

1. Supabase MCP tools available (`list_projects`, `list_tables`, `execute_sql`, `apply_migration`). Confirm the project by name: call `list_projects` and use the entry named **"tradebook"** — do NOT assume an id from a prior session; a previous mistake in this workspace built against the wrong project entirely, so this check is not optional.
2. `.env.local` already exists in the repo root (gitignored, real values) — Task 11 depends on it for local dev + Stripe CLI. Before running any `stripe trigger` command, the Task 11 implementer must confirm `STRIPE_SECRET_KEY` in `.env.local` starts with `sk_test_` (test mode). If it does not, STOP and escalate — never fire synthetic events at a live Stripe key.
3. Stripe CLI (`stripe`) must be installed for Task 11 (`stripe --version`); if missing, install it first (`scoop install stripe` or the Windows binary from Stripe's docs) — this is a one-time local dev tool, not a project dependency.

## `tsc --noEmit` baseline — read before any task's "Typecheck" step

**This repo already fails `npx tsc --noEmit` with ~50+ pre-existing errors**, unrelated to this project (`Scanner.tsx`, `strategyService.ts`, `tradeService.ts`, `noteService.ts`, `propTrackerService.ts`, `support-chat/route.ts`, and others). Two categories matter specifically to this plan:

- **`src/lib/stripe.ts(4,3): error TS2322: Type '"2024-04-10"' is not assignable to type '"2026-05-27.dahlia"'`** — the installed `stripe` npm package's types expect a newer API-version literal than the code uses. Pre-existing, in a file Tasks 6 and 7 both modify. **Do not fix this** (changing the pinned API version is out of scope and could change webhook payload shapes) — it will still be present after your change, and that is correct, not a regression.
- **`Property 'first_name' does not exist on type 'never'`** (and similarly for `last_name`, `bio`, `avatar_url`, `trader_types`, `has_seen_intro`) in `src/components/Settings.tsx`, `ProfileMenu.tsx`, `Sidebar.tsx`, `OnboardingTour.tsx`, `AIAnalysis.tsx`, and `src/app/api/subscription/route.ts` — root cause (found during Task 1): `@supabase/ssr@0.5.2`'s type declarations import a subpath (`@supabase/supabase-js/dist/module/lib/types`) that no longer exists in the installed `@supabase/supabase-js@2.108.2`, silently breaking the `Database` generic for **every** `.from(<table>)` call app-wide, masked by `skipLibCheck: true`. Registering `profiles`/`referral_commissions` in `Database.Tables` (Task 1) is necessary but NOT sufficient to fix this — **Task 2 fixes the actual root cause** by upgrading `@supabase/ssr`. Expect these errors to persist through Task 1 and disappear only after Task 2.

Task 1's Step 0 below captures the exact baseline to a file. Every later task's "Typecheck" step means: run `npx tsc --noEmit`, then confirm every line in the new output either (a) also appears in the baseline file, or (b) is one of the `profiles`-shaped `never` errors expected to be resolved once Task 2 lands (not Task 1 alone) — never "eyeball it and assume it's fine." If a task's typecheck step shows a genuinely new error outside those two cases, stop and report it — don't fix it silently and don't ignore it.

---

### Task 1: Schema catch-up migration for `profiles` and `referral_commissions`

`profiles` and `referral_commissions` are used throughout the codebase but were never committed to a migration (`supabase/migrations/` has only `001_initial_schema.sql`, covering `trades`/`notes`/`strategies`). This task introspects the live shape, commits it, and fixes two integrity gaps before any partner column is added.

**Files:**
- Create: `supabase/migrations/002_profiles_and_referrals_catchup.sql`
- Modify: `src/lib/types.ts` (add `profiles` and `referral_commissions` to the `Database.Tables` type)

**Interfaces:**
- Consumes: nothing (this is the foundation task).
- Produces: `Database['public']['Tables']['profiles']` and `['referral_commissions']` types importable from `src/lib/types.ts`, relied on by every later task's Supabase client calls (`createClient<Database>()` usages, if any — this repo's `createClient()` in `src/lib/supabase/server.ts` is currently untyped; check it and only add generic typing if it already threads one through — do not introduce new typing plumbing beyond what's already there).

- [ ] **Step 0: Capture the pre-change `tsc` baseline**

Run: `npx tsc --noEmit > .superpowers/sdd/tsc-baseline.txt 2>&1` (create the `.superpowers/sdd/` directory first if it doesn't exist: it's scratch space for this plan's execution, not project source — do not add it to git). This file already contains ~50+ pre-existing errors (see the "`tsc --noEmit` baseline" section above the task list) — that's expected. Every later task's typecheck step diffs against this exact file.

- [ ] **Step 1: Confirm the project and introspect the live schema**

Call `list_projects` and find the entry named `tradebook`; use its id as `PROJECT_ID` for every step below. Call `list_tables` with `project_id: PROJECT_ID`, `schemas: ["public"]`, `verbose: true`. Find the `profiles` and `referral_commissions` entries and record: **every** column with its exact type and nullability, primary key, all foreign keys with their `on delete` action, and any unique constraints or indexes. This must be the complete live column list, not just the columns this project's referral/Stripe code happens to touch — `profiles` also has columns used elsewhere in the app (at minimum: `last_name`, `bio`, `avatar_url`, `trader_types`, `has_seen_intro`, found via the `never`-type errors in the baseline — cross-check your introspection captures all of them, plus anything else live that no grep would have surfaced).

- [ ] **Step 2: Check current RLS state**

Run via `execute_sql`:

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles', 'referral_commissions');
```

Record the result (true/false for each). Also run:

```sql
select tablename, policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename in ('profiles', 'referral_commissions');
```

Record every policy found (or confirm zero rows). This explains why the existing session-scoped admin routes (`/api/referrals/admin/mark-paid`) can currently update arbitrary rows — document the actual finding, don't guess.

- [ ] **Step 3: Write the catch-up migration**

Using the exact column list, types, and constraints from Step 1, write `supabase/migrations/002_profiles_and_referrals_catchup.sql`. It must use `create table if not exists` (idempotent — these tables already exist live; this migration documents them, it does not create them fresh) and must NOT use `create table` bare, since that would fail against the live database when eventually run via a migration tool. Structure:

```sql
-- Catch-up migration: profiles and referral_commissions were created directly
-- against the live database (Supabase dashboard) and were never committed to
-- a migration file, despite being used throughout the app. This migration
-- documents their actual live shape (introspected via Supabase MCP on
-- <DATE>) and is a no-op against the live database except for the two fixes
-- below. If ever run against a fresh database, it recreates both tables.
--
-- RLS finding: <FILL IN THE ACTUAL RESULT FROM STEP 2 -- e.g. "RLS is
-- disabled on both tables; no policies exist. The session-scoped admin
-- routes work today because of this, not because of a permissive policy.
-- Not changed by this migration.">

create table if not exists public.profiles (
  -- <FILL IN EXACT COLUMNS FROM STEP 1 INTROSPECTION, e.g.:>
  -- id uuid primary key references auth.users(id) on delete cascade,
  -- first_name text,
  -- newsletter_opt_in boolean not null default false,
  -- referral_code text,
  -- referred_by uuid references public.profiles(id),
  -- stripe_customer_id text,
  -- stripe_subscription_id text,
  -- subscription_status text,
  -- plan text not null default 'free',
  -- created_at timestamptz not null default now()
);

create table if not exists public.referral_commissions (
  -- <FILL IN EXACT COLUMNS FROM STEP 1 INTROSPECTION, matching
  --  ReferralCommissionRow in src/lib/types.ts:314-325 as a cross-check:
  --  id, referrer_id, referred_user_id, stripe_invoice_id (unique),
  --  gross_amount, commission_amount, status, available_at, paid_at,
  --  created_at>
);

-- Fix 1: a referred user deleting their own account (self-serve deletion
-- exists in src/components/Settings.tsx) must not erase the referrer's
-- already-earned commission history. A partner account must be settled
-- before it can be deleted at all.
alter table public.referral_commissions
  drop constraint if exists <EXACT NAME FROM STEP 1, e.g. referral_commissions_referrer_id_fkey>,
  add constraint referral_commissions_referrer_id_fkey
    foreign key (referrer_id) references public.profiles(id) on delete restrict;

alter table public.referral_commissions
  drop constraint if exists <EXACT NAME FROM STEP 1, e.g. referral_commissions_referred_user_id_fkey>,
  add constraint referral_commissions_referred_user_id_fkey
    foreign key (referred_user_id) references public.profiles(id) on delete set null;

-- referred_user_id must be nullable for the "set null" above to work.
alter table public.referral_commissions
  alter column referred_user_id drop not null;

-- Fix 2: referral_code assignment today is a check-then-insert race
-- (src/lib/referrals.ts ensureReferralCode / this project's new
-- admin-assign endpoint) with no DB-level guarantee. Enforce uniqueness.
alter table public.profiles
  add constraint profiles_referral_code_key unique (referral_code);
```

Replace every `<...>` placeholder with the real values found in Steps 1-2 before applying anything. Do not guess a column list — if introspection shows a column this plan didn't anticipate (e.g. an `email` column on `profiles`), include it in the `create table if not exists` block anyway, since it must match the live table exactly.

- [ ] **Step 4: Apply the migration**

Call `apply_migration` with `project_id: PROJECT_ID`, `name: "profiles_and_referrals_catchup"`, and the exact SQL from Step 3. Since the tables already exist, `create table if not exists` will no-op on the table bodies — only the constraint `alter`s actually change anything. Expected: success, no errors.

- [ ] **Step 5: Verify the two fixes**

Run via `execute_sql`:

```sql
select conname, confdeltype
from pg_constraint
where conrelid = 'public.referral_commissions'::regclass and contype = 'f';
```

Expected: the `referrer_id` FK shows `confdeltype = 'r'` (restrict), the `referred_user_id` FK shows `confdeltype = 'n'` (set null).

```sql
select conname from pg_constraint
where conrelid = 'public.profiles'::regclass and contype = 'u' and conname = 'profiles_referral_code_key';
```

Expected: one row.

- [ ] **Step 6: Verify the FK behavior end to end (rolled back)**

```sql
begin;
-- pick any two existing profiles not already linked as referrer/referred
insert into public.referral_commissions
  (referrer_id, referred_user_id, stripe_invoice_id, gross_amount, commission_amount, status, available_at)
select
  (select id from public.profiles order by id limit 1),
  (select id from public.profiles where id <> (select id from public.profiles order by id limit 1) limit 1),
  'evt-catchup-test-1', 10.00, 2.00, 'pending', now();

-- deleting the REFERRED user must succeed and set referred_user_id to null
delete from auth.users where id = (select id from public.profiles where id <> (select id from public.profiles order by id limit 1) limit 1);
select referred_user_id from public.referral_commissions where stripe_invoice_id = 'evt-catchup-test-1';
-- expected: referred_user_id is null, row still exists

-- deleting the REFERRER (partner) must FAIL
delete from auth.users where id = (select id from public.profiles order by id limit 1);
-- expected: ERROR - foreign key violation (referral_commissions_referrer_id_fkey)
rollback;
```

Expected: the referred-user delete succeeds with the row surviving (`referred_user_id` becomes null); the referrer delete raises a foreign-key violation. The `rollback` discards both test deletes — confirm afterward with `select count(*) from public.referral_commissions where stripe_invoice_id = 'evt-catchup-test-1';` → 0.

- [ ] **Step 7: Add both tables to the TS `Database` type**

Read `src/lib/types.ts:314-370` for the exact pattern (`ReferralCommissionRow`/`ReferralCommissionInsert` already exist at lines 314-326; there is no `ProfileRow` type yet). Add, near the existing `ReferralCommissionRow`/`Insert` types (before the `Database` type at line 328), a `ProfileRow` with **every** column from Step 1's introspection — not a subset. At minimum it must include the columns this project touches (`id`, `first_name`, `newsletter_opt_in`, `referral_code`, `referred_by`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `plan`, `created_at`) AND every column the baseline's `never`-type errors reference (`last_name`, `bio`, `avatar_url`, `trader_types`, `has_seen_intro`) AND anything else Step 1 found that isn't in either list. Example shape (fill in the real, complete set from Step 1 — do not ship this exact list unmodified):

```ts
export type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  bio: string | null
  avatar_url: string | null
  trader_types: string[] | null
  has_seen_intro: boolean
  newsletter_opt_in: boolean
  referral_code: string | null
  referred_by: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  plan: string
  created_at: string
  // ... plus any further column Step 1's live introspection found
}
export type ProfileInsert = Partial<Omit<ProfileRow, 'id'>> & { id: string }
export type ProfileUpdate = Partial<Omit<ProfileRow, 'id'>>
```

Then inside the `Database.public.Tables` object (after the `strategies` entry at `src/lib/types.ts:345`, matching the existing per-table shape), add:

```ts
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      referral_commissions: {
        Row: ReferralCommissionRow
        Insert: ReferralCommissionInsert
        Update: Partial<Omit<ReferralCommissionRow, 'id' | 'created_at'>>
      }
```

- [ ] **Step 8: Typecheck — compare against the Step 0 baseline**

Run: `npx tsc --noEmit > .superpowers/sdd/tsc-after-task1.txt 2>&1` then diff it against `.superpowers/sdd/tsc-baseline.txt` (e.g. `diff .superpowers/sdd/tsc-baseline.txt .superpowers/sdd/tsc-after-task1.txt`). **Expected: the diff is empty (zero lines differ).** The `profiles`-shaped `never`-type errors do NOT disappear yet — a separate pre-existing bug (an `@supabase/ssr`/`@supabase/supabase-js` version mismatch breaking the `Database` generic app-wide) prevents that regardless of what this task adds to `Database.Tables`; Task 2 fixes the actual root cause. If you discover this bug independently while investigating an unexpectedly-empty diff, do not attempt to fix it here — it's out of this task's two-file scope; just confirm the diff is empty and move on. If the diff shows anything OTHER than an empty result (any new error, anywhere), that IS a real problem with this task's changes — stop and report it.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/002_profiles_and_referrals_catchup.sql src/lib/types.ts
git commit -m "db: catch up profiles/referral_commissions migration; ledger FKs survive account deletion"
```

(Do not commit `.superpowers/sdd/*.txt` — it's scratch verification output, not project source.)

---

> **Tasks 2 and 3 were added after Task 1 uncovered two pre-existing issues beyond this plan's original scope**: (a) an `@supabase/ssr`/`@supabase/supabase-js` version mismatch silently disables real TypeScript checking for every Supabase table call in the app, and (b) the Stripe webhook and the two existing referral-admin routes use a session-scoped client with no applicable RLS policy for their cross-user writes, so `/api/referrals/admin/mark-paid` likely reports success while updating zero rows. Both are fixed here, in this branch, before any partner-specific code is built on top of them — confirmed with the user as the right scope (a related but separate `profiles` RLS policy misconfiguration, found at the same time, is being fixed independently on its own branch and is NOT touched by this plan).

### Task 2: Restore Supabase `Database` type-checking (fix `@supabase/ssr` version mismatch)

Task 1 found that `@supabase/ssr@0.5.2`'s type declarations import a subpath (`@supabase/supabase-js/dist/module/lib/types`) that doesn't exist in the installed `@supabase/supabase-js@2.108.2`, silently breaking the `Database` generic for every `.from(<table>)` call app-wide (masked by `tsconfig.json`'s `skipLibCheck: true`). This means EVERY table — not just `profiles`/`referral_commissions` — has been resolving to `never`-typed rows, and none of this plan's later "compare against baseline" typecheck steps can catch a real Supabase-shape mistake until this is fixed. This task fixes the actual root cause and produces a new, trustworthy baseline for every task after it.

**Files:**
- Modify: `package.json`, `package-lock.json` (dependency version bump)
- Possibly modify: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts` — only if the chosen version's cookie-handling API (`getAll`/`setAll`) actually changed shape (see Step 1).

**Interfaces:**
- Consumes: `.superpowers/sdd/tsc-baseline.txt` from Task 1 (read-only, for comparison).
- Produces: a working `Database` generic through `createServerClient<Database>()`/`createBrowserClient<Database>()`; a NEW `.superpowers/sdd/tsc-baseline.txt` (this task overwrites Task 1's file) that Tasks 4 onward diff against instead of the original.

- [ ] **Step 1: Determine the target version and check for breaking changes**

```bash
npm ls @supabase/ssr @supabase/supabase-js
npm view @supabase/ssr versions --json
```

Pick the latest published `@supabase/ssr` version. Before installing, check whether its cookie-handling interface differs from what's currently used in `src/lib/supabase/server.ts` (`cookies: { getAll() {...}, setAll(cookiesToSet) {...} }` — the modern `@supabase/ssr` 0.4+ shape). Check the package's CHANGELOG (via `npm view @supabase/ssr@<version>` metadata, or by reading `node_modules/@supabase/ssr/CHANGELOG.md` after a trial install in a scratch location, or the GitHub releases page) for ANY change to `getAll`/`setAll`'s signature or to how `createServerClient`/`createBrowserClient` are called. If you find such a change, note exactly what's different — you'll need to update `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, and `src/lib/supabase/middleware.ts` to match in Step 2. If you cannot find clear changelog information and the diff between the installed version and latest spans multiple major/minor versions with unclear cookie-API stability, escalate as BLOCKED rather than guessing — this touches every user's session cookie handling in production.

- [ ] **Step 2: Install and adapt if needed**

```bash
npm install @supabase/ssr@<chosen-version>
```

If Step 1 found a cookie-API change, update the affected file(s) to match the new signature now. If not, no source changes are needed — this is a pure dependency bump.

- [ ] **Step 3: Typecheck and evaluate the diff carefully**

```bash
npx tsc --noEmit > .superpowers/sdd/tsc-after-ssr-fix.txt 2>&1
diff .superpowers/sdd/tsc-baseline.txt .superpowers/sdd/tsc-after-ssr-fix.txt
```

Categorize every line in the diff into exactly one of three buckets:
1. **Expected resolutions** — the `profiles`-shaped `never` errors in `Settings.tsx`, `ProfileMenu.tsx`, `Sidebar.tsx`, `OnboardingTour.tsx`, `AIAnalysis.tsx`, `subscription/route.ts` should now be GONE. Confirm they are.
2. **Newly-exposed errors on OTHER tables** — since this bug affected `.from(<any table>)` universally, fixing it may reveal genuinely new type mismatches in code that was previously silently unchecked for `trades`, `notes`, `strategies`, `open_legs`, `broker_connections`, `prop_firm_accounts`, etc. (all of which already have `Row`/`Insert` types defined in `src/lib/types.ts`, but were never actually being checked against them until now). **Do not fix these.** They are a separate, potentially large pre-existing-bug-surface this task did not create and should not silently expand into fixing. List every one found, with file:line, in your report and stop there.
3. **Anything else** — a genuinely new error unrelated to either of the above (e.g., from the version bump itself, or a cookie-API mismatch you missed in Step 1) — this DOES need fixing or escalating, since it's a regression this task introduced.

- [ ] **Step 4: Verify auth still works (critical — this is the production session/cookie path)**

```bash
npm run dev
```

Manually verify: sign up a new throwaway test account, confirm you land in a signed-in state; sign out; sign back in with the same credentials; reload the page while signed in and confirm the session persists (no bounce to `/login`); visit a protected route while signed out and confirm the middleware redirect to `/login` still fires. If ANY of these regress, this is a Critical issue — do not proceed to commit; investigate whether Step 1's changelog check missed something.

- [ ] **Step 5: Save the new baseline**

```bash
cp .superpowers/sdd/tsc-after-ssr-fix.txt .superpowers/sdd/tsc-baseline.txt
```

Every later task in this plan diffs against this file, not the one Task 1 created.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: upgrade @supabase/ssr to restore Database type-checking"
```

(Add any Step 2 source files to this commit too, if the cookie API required adaptation. Do not commit `.superpowers/sdd/*.txt`.)

---

### Task 3: Convert the Stripe webhook and referral-admin routes to a service-role Supabase client

Task 1 found that `referral_commissions` has no INSERT/UPDATE/DELETE RLS policy at all, and the Stripe webhook and both existing `/api/referrals/admin/*` routes use the plain session-scoped (cookie-based) client — which has no session at all for the webhook (Stripe's POST carries no Supabase auth cookie) and, for the admin routes, a session that can't satisfy any policy scoped to `auth.uid() = referrer_id`. Under Postgres RLS, this means `/api/referrals/admin/mark-paid`'s `UPDATE` likely matches zero rows silently (no error, no rows changed) while still reporting success. The right fix is architectural, not a permissive policy: none of these three routes are acting on behalf of a browser session anyway (the webhook is server-to-server; the admin routes are already gated by the `ADMIN_EMAILS` allowlist at the application layer) — they should use a service-role client for their data operations, exactly like the pattern `src/lib/referrals.ts`'s existing (currently unexported) `adminClient()` already establishes for `ensureReferralCode`/`attributeReferral`.

**Files:**
- Modify: `src/lib/referrals.ts:62-67` (export the existing `adminClient()` instead of leaving it file-private)
- Modify: `src/app/api/stripe/webhook/route.ts` (swap the client construction only)
- Modify: `src/app/api/referrals/admin/mark-paid/route.ts`
- Modify: `src/app/api/referrals/admin/payouts/route.ts`

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: `adminClient()` exported from `src/lib/referrals.ts`, consumed by Task 9 (which imports it instead of defining its own local copy) and by this task's own three call sites.

- [ ] **Step 1: Diagnostic — has `referral_commissions` ever actually been written to?**

Via Supabase MCP `execute_sql` against the confirmed `PROJECT_ID` (same "tradebook" project Task 1 confirmed):

```sql
select count(*) as total_rows, count(*) filter (where status = 'paid') as paid_rows
from public.referral_commissions;
```

Record the result in your report either way — this settles whether the friend-referral commission ledger has ever recorded anything in production, independent of whether this task's fix later gets exercised.

- [ ] **Step 2: Export the existing `adminClient()` helper**

In `src/lib/referrals.ts`, change:

```ts
function adminClient() {
```

to:

```ts
export function adminClient() {
```

No other change to that function.

- [ ] **Step 3: Convert the webhook to the service-role client**

In `src/app/api/stripe/webhook/route.ts`, this repo's webhook currently does:

```ts
import { stripe, planForPriceId } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
```
...
```ts
  const supabase = createClient()
```

Replace the import and the client construction (keep the local variable name `supabase` — every `.from(...)` call site in this file stays untouched):

```ts
import { stripe, planForPriceId } from '@/lib/stripe'
import { adminClient } from '@/lib/referrals'
```
...
```ts
  // Service-role: a Stripe webhook has no browser session/cookie at all, and
  // needs to write profiles/referral_commissions rows for users other than
  // any caller. Session-scoped RLS was never the right model here.
  const supabase = adminClient()
```

Do not touch anything else in this file — no case in the event switch needs to change, since they all already refer to `supabase.from(...)`.

- [ ] **Step 4: Convert the two admin routes — keep the auth check, add a service-role client for data**

In `src/app/api/referrals/admin/mark-paid/route.ts`, currently:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
```
...
```ts
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { commissionIds } = await request.json()
  if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
    return NextResponse.json({ error: 'commissionIds array is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('referral_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .in('id', commissionIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, marked: commissionIds.length })
}
```

Change to (add the import, keep `supabase` for the auth check only, add `admin` for the data write, and check `data`'s row count so a genuine zero-match no longer silently reports success):

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/referrals'
```
...
```ts
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { commissionIds } = await request.json()
  if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
    return NextResponse.json({ error: 'commissionIds array is required' }, { status: 400 })
  }

  const admin = adminClient()
  const { data, error } = await admin
    .from('referral_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .in('id', commissionIds)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, marked: data?.length ?? 0 })
}
```

Apply the equivalent change to `src/app/api/referrals/admin/payouts/route.ts`: keep its `const supabase = createClient()` + `auth.getUser()` check as-is for the `ADMIN_EMAILS` gate, add `import { adminClient } from '@/lib/referrals'`, add `const admin = adminClient()` after the auth check, and change its two read queries (`.from('referral_commissions')...` and `.from('profiles')...`) from `supabase.` to `admin.`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` and compare against `.superpowers/sdd/tsc-baseline.txt` (Task 2's file). Expected: identical to baseline.

- [ ] **Step 6: Verify mark-paid actually works now (the first real proof, given Step 1's finding)**

Seed a disposable, real (committed, not rolled back — this must be visible to the separate HTTP request the running dev server makes) test row via `execute_sql`, using any two existing real profile ids:

```sql
insert into public.referral_commissions
  (referrer_id, referred_user_id, stripe_invoice_id, gross_amount, commission_amount, status, available_at)
values
  ('<ANY_REAL_PROFILE_ID>', '<ANY_OTHER_REAL_PROFILE_ID>', 'evt-task3-markpaid-test', 10.00, 2.00, 'pending', now() - interval '31 days');
```

Run `npm run dev`, sign in as an `ADMIN_EMAILS` account, visit `/admin/referrals`, confirm the seeded row now appears as payout-ready (past the 30-day hold), click "Mark Paid", and confirm via `execute_sql`:

```sql
select status, paid_at from public.referral_commissions where stripe_invoice_id = 'evt-task3-markpaid-test';
```

Expected: `status = 'paid'`, `paid_at` set — this is the first real evidence this endpoint has ever worked end to end. Then clean up:

```sql
delete from public.referral_commissions where stripe_invoice_id = 'evt-task3-markpaid-test';
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/referrals.ts src/app/api/stripe/webhook/route.ts src/app/api/referrals/admin/mark-paid/route.ts src/app/api/referrals/admin/payouts/route.ts
git commit -m "admin: use a service-role client for webhook + referral-admin writes (mark-paid was silently no-op-ing)"
```

---

### Task 4: Partner columns migration

**Files:**
- Create: `supabase/migrations/003_add_partner_columns.sql`
- Modify: `src/lib/types.ts` (extend `ProfileRow` and `ReferralCommissionRow` with the new columns)

**Interfaces:**
- Consumes: `PROJECT_ID` (re-confirm via `list_projects` — do not reuse a value from a different task's memory without re-checking), the `profiles`/`referral_commissions` tables from Task 1.
- Produces: `profiles.is_partner`, `profiles.commission_rate`, `profiles.commission_months`, `referral_commissions.program`, `referral_commissions.reversal_of` — relied on by every later task.

- [ ] **Step 1: Write the migration**

`supabase/migrations/003_add_partner_columns.sql`:

```sql
-- Partner/affiliate columns. Two-track model: existing rows are unaffected
-- friend referrals (commission_months default 6, matching current webhook
-- behavior exactly); admins flag an account as a partner via a new endpoint,
-- which sets is_partner=true and commission_months=12.

alter table public.profiles
  add column if not exists is_partner boolean not null default false,
  add column if not exists commission_rate numeric not null default 0.20,
  add column if not exists commission_months int not null default 6;

alter table public.referral_commissions
  add column if not exists program text not null default 'friend'
    check (program in ('friend', 'partner')),
  add column if not exists reversal_of uuid references public.referral_commissions(id);
```

- [ ] **Step 2: Apply the migration**

Call `apply_migration` with `project_id: PROJECT_ID`, `name: "add_partner_columns"`, the SQL above.

- [ ] **Step 3: Verify**

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('is_partner', 'commission_rate', 'commission_months');
```

Expected: 3 rows — `is_partner` boolean default `false`, `commission_rate` numeric default `0.20`, `commission_months` integer default `6`.

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'referral_commissions'
  and column_name in ('program', 'reversal_of');
```

Expected: 2 rows.

```sql
select distinct program from public.referral_commissions;
```

Expected: either zero rows (empty table) or `friend` only (every existing row defaults to `friend` — no partner existed before this migration).

- [ ] **Step 4: Extend the TS types**

In `src/lib/types.ts`, update the `ProfileRow` type added in Task 1 to add:

```ts
  is_partner: boolean
  commission_rate: number
  commission_months: number
```

Update `ReferralCommissionRow` (existing, at line ~314) to add:

```ts
  program: 'friend' | 'partner'
  reversal_of: string | null
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` and compare against `.superpowers/sdd/tsc-baseline.txt` (same method as Task 1 Step 8, comparing against the ORIGINAL baseline file — Task 4 doesn't create its own). Expected new error: `src/app/api/stripe/webhook/route.ts:137-145`'s existing `invoice.paid` upsert call no longer supplies `program`/`reversal_of`, which `ReferralCommissionInsert = Omit<ReferralCommissionRow, 'id' | 'created_at'>` now requires (both new fields are non-optional on insert). This ONE new error at that exact call site is expected — Task 6 fixes it by rewriting that block. If any OTHER new error appears, report it, don't fix it here.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/003_add_partner_columns.sql src/lib/types.ts
git commit -m "db: add partner columns (is_partner, commission_rate, commission_months, program, reversal_of)"
```

---

### Task 5: Pure commission module + Vitest setup

This repo has no test framework. This task adds Vitest (minimal config, no DOM needed — pure TS module tests only) and the commission math module both the webhook (Task 8/7) and nothing else will depend on.

**Files:**
- Create: `src/lib/commission.ts`
- Create: `src/lib/commission.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency and a `"test": "vitest run"` script)

**Interfaces:**
- Consumes: nothing (pure, dependency-free module).
- Produces (from `src/lib/commission.ts`, imported by Task 8/7's webhook changes):
  - `isWithinCommissionWindow(signupIso: string, months: number, nowIso: string): boolean`
  - `computeCommission(amountPaidCents: number, rate: number): { grossUsd: number; commissionUsd: number } | null`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
    "test": "vitest run"
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/lib/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write the failing tests**

`src/lib/commission.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeCommission, isWithinCommissionWindow } from './commission'

describe('isWithinCommissionWindow', () => {
  it('is true on the exact boundary (N months later, same day)', () => {
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 6, '2026-07-15T00:00:00.000Z')).toBe(true)
  })
  it('is true well within the window', () => {
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 6, '2026-03-01T00:00:00.000Z')).toBe(true)
  })
  it('is false one day past the boundary', () => {
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 6, '2026-07-16T00:00:00.000Z')).toBe(false)
  })
  it('handles a 12-month partner window', () => {
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 12, '2027-01-15T00:00:00.000Z')).toBe(true)
    expect(isWithinCommissionWindow('2026-01-15T00:00:00.000Z', 12, '2027-01-16T00:00:00.000Z')).toBe(false)
  })
})

describe('computeCommission', () => {
  it('computes 20% of the gross amount, rounded to cents', () => {
    expect(computeCommission(2900, 0.20)).toEqual({ grossUsd: 29, commissionUsd: 5.8 })
  })
  it('computes a non-20% rate correctly', () => {
    expect(computeCommission(999, 0.15)).toEqual({ grossUsd: 9.99, commissionUsd: 1.5 })
  })
  it('rounds to the nearest cent rather than truncating', () => {
    // 33.33 cents of gross at 20% = 6.666 -> rounds to 6.67, not 6.66
    expect(computeCommission(3333, 0.20)).toEqual({ grossUsd: 33.33, commissionUsd: 6.67 })
  })
  it('returns null for zero or negative amounts', () => {
    expect(computeCommission(0, 0.20)).toBeNull()
    expect(computeCommission(-500, 0.20)).toBeNull()
  })
})
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run src/lib/commission.test.ts`
Expected: FAIL — `Cannot find module './commission'` (or similar resolution error), since `commission.ts` doesn't exist yet.

- [ ] **Step 6: Write `src/lib/commission.ts`**

```ts
// Pure commission math, shared by the Stripe webhook's invoice.paid and
// charge.refunded handlers. No Supabase/Stripe imports -- keeps this
// unit-testable without mocking either SDK.

const round2 = (n: number) => Math.round(n * 100) / 100

// True when `nowIso` falls on or before `months` months after `signupIso`
// (inclusive boundary -- the exact N-months-later instant still counts).
export function isWithinCommissionWindow(signupIso: string, months: number, nowIso: string): boolean {
  const cutoff = new Date(signupIso)
  cutoff.setMonth(cutoff.getMonth() + months)
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/commission.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit` and compare against `.superpowers/sdd/tsc-baseline.txt`. Expected: identical to baseline — this task adds a standalone module with no consumers yet, so it cannot introduce or fix any error.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/commission.ts src/lib/commission.test.ts
git commit -m "test: add Vitest and pure commission math module"
```

---

### Task 6: Webhook — partner-aware `invoice.paid`

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts:109-147` (the `invoice.paid` case)

**Interfaces:**
- Consumes: `isWithinCommissionWindow`, `computeCommission` from `./commission` (Task 5); `profiles.is_partner`/`commission_rate`/`commission_months`, `referral_commissions.program` (Task 4); the `supabase` variable in this file is now a service-role client via `adminClient()` (Task 3) — this task must run after Task 3.
- Produces: no new exports — this is the webhook's behavior, consumed only by Stripe's real delivery and Task 11's verification.

- [ ] **Step 1: Add the import**

At the top of `src/app/api/stripe/webhook/route.ts` (after the existing `import { stripe, planForPriceId } from '@/lib/stripe'` at line 2), add:

```ts
import { computeCommission, isWithinCommissionWindow } from '@/lib/commission'
```

- [ ] **Step 2: Replace the `invoice.paid` case**

Replace the entire `case 'invoice.paid':` block (currently `src/app/api/stripe/webhook/route.ts:109-147`) with:

```ts
      case 'invoice.paid': {
        const invoice = event.data.object as any
        const customerId = invoice.customer
        const invoiceId = invoice.id
        const amountPaidCents = invoice.amount_paid || 0

        const { data: payer } = await supabase
          .from('profiles')
          .select('id, referred_by, created_at')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!payer || !payer.referred_by) break // this customer wasn't referred

        const { data: referrer } = await supabase
          .from('profiles')
          .select('is_partner, commission_rate, commission_months')
          .eq('id', payer.referred_by)
          .maybeSingle()

        if (!referrer) break // referrer account no longer exists

        if (!isWithinCommissionWindow(payer.created_at, referrer.commission_months, new Date().toISOString())) {
          break // outside this referrer's earning window
        }

        const amounts = computeCommission(amountPaidCents, referrer.commission_rate)
        if (!amounts) break // zero/negative payment -- nothing to commission

        const availableAt = new Date()
        availableAt.setDate(availableAt.getDate() + 30) // 30-day holding period

        // stripe_invoice_id has a unique constraint, so this is safe to call
        // even if Stripe redelivers the same webhook event.
        await supabase.from('referral_commissions').upsert({
          referrer_id: payer.referred_by,
          referred_user_id: payer.id,
          stripe_invoice_id: invoiceId,
          gross_amount: amounts.grossUsd,
          commission_amount: amounts.commissionUsd,
          status: 'pending',
          available_at: availableAt.toISOString(),
          program: referrer.is_partner ? 'partner' : 'friend',
          reversal_of: null,
          paid_at: null,
        }, { onConflict: 'stripe_invoice_id' })
        break
      }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` and compare against `.superpowers/sdd/tsc-baseline.txt`. Expected: identical to the current baseline (Task 2's file) — the pre-existing error at this file/line (missing `program`/`reversal_of`/`paid_at` on the `referral_commissions` upsert) is now gone, since the object above supplies all three.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "webhook: invoice.paid reads per-referrer rate/window instead of hardcoded 20%/6mo"
```

---

### Task 7: Webhook — `charge.refunded` clawback

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts` (add a new `case` to the event switch)

**Interfaces:**
- Consumes: `referral_commissions.program`/`reversal_of` (Task 4); the `supabase` variable in this file is a service-role client via `adminClient()` (Task 3) — this task must run after Task 3.
- Produces: no new exports.

- [ ] **Step 1: Add the new case**

In `src/app/api/stripe/webhook/route.ts`, inside the `switch (event.type) {` block, add a new case immediately after the closing `break }` of `case 'invoice.paid':` (i.e., as the last case before the switch's closing brace):

```ts
      case 'charge.refunded': {
        const charge = event.data.object as any
        if (!charge.invoice) break // not an invoice payment -- nothing to claw back
        if ((charge.amount_refunded || 0) < charge.amount) break // partial refund: out of scope for v1

        const { data: original } = await supabase
          .from('referral_commissions')
          .select('id, referrer_id, referred_user_id, gross_amount, commission_amount, program')
          .eq('stripe_invoice_id', charge.invoice)
          .maybeSingle()

        if (!original) break // this invoice was never commissioned

        // stripe_invoice_id is unique, so the reversal needs its own key.
        // charge.id is stable across webhook redeliveries for the same
        // refund, so upserting on it is idempotent, exactly like the
        // invoice.paid handler above.
        await supabase.from('referral_commissions').upsert({
          referrer_id: original.referrer_id,
          referred_user_id: original.referred_user_id,
          stripe_invoice_id: `refund_${charge.id}`,
          gross_amount: -Number(original.gross_amount),
          commission_amount: -Number(original.commission_amount),
          status: 'pending',
          // No 30-day hold on a reversal -- it should net against the next
          // payout run immediately, even if the original commission was
          // already paid out (that case produces a negative balance for
          // the admin to resolve manually; cash already wired can't be
          // un-sent by this system).
          available_at: new Date().toISOString(),
          program: original.program,
          reversal_of: original.id,
          paid_at: null,
        }, { onConflict: 'stripe_invoice_id' })
        break
      }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` and compare against `.superpowers/sdd/tsc-baseline.txt` (the current one, from Task 2). Expected: identical to that baseline (the `stripe.ts` apiVersion error from the "`tsc --noEmit` baseline" section will still appear in this file's error output if TypeScript reports it per-file rather than per-project-error — that's the same pre-existing error, not a new one).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "webhook: charge.refunded reverses commission via a negative ledger row"
```

---

### Task 8: Partner-aware `/api/referrals/me` and `ReferralsPage` copy

`ReferralsPage.tsx:48` hardcodes "first 6 months" — once partners exist, a partner viewing this same shared page would see the wrong number.

**Files:**
- Modify: `src/app/api/referrals/me/route.ts:12-22,50-60`
- Modify: `src/components/ReferralsPage.tsx:6-11,44-49`

**Interfaces:**
- Consumes: `profiles.commission_months` (Task 4).
- Produces: `GET /api/referrals/me` response gains a top-level `commissionMonths: number` field, consumed by `ReferralsPage.tsx`.

- [ ] **Step 1: Extend the API response**

In `src/app/api/referrals/me/route.ts`, change the profile select at line 12-16 from:

```ts
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, referral_code')
    .eq('id', user.id)
    .maybeSingle()
```

to:

```ts
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, referral_code, commission_months')
    .eq('id', user.id)
    .maybeSingle()
```

Then in the final `return NextResponse.json({...})` (currently lines 50-60), add `commissionMonths` as a top-level field:

```ts
  return NextResponse.json({
    code,
    link,
    commissionMonths: profile?.commission_months ?? 6,
    stats: {
      referredCount: referredCount || 0,
      pendingAmount,
      availableAmount,
      paidAmount,
    },
    commissions: rows,
  })
```

- [ ] **Step 2: Update the component's type and copy**

In `src/components/ReferralsPage.tsx`, change the `data` state type (lines 6-11) from:

```ts
  const [data, setData] = useState<{
    code: string
    link: string
    stats: { referredCount: number; pendingAmount: number; availableAmount: number; paidAmount: number }
    commissions: any[]
  } | null>(null)
```

to:

```ts
  const [data, setData] = useState<{
    code: string
    link: string
    commissionMonths: number
    stats: { referredCount: number; pendingAmount: number; availableAmount: number; paidAmount: number }
    commissions: any[]
  } | null>(null)
```

Then change the hardcoded description (line 48) from:

```tsx
        Earn 20% of what your referrals pay for their first 6 months. New users get nothing extra yet — ask us about a signup discount if you want one added.
```

to:

```tsx
        Earn 20% of what your referrals pay for their first {data.commissionMonths} months. New users get nothing extra yet — ask us about a signup discount if you want one added.
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` and compare against `.superpowers/sdd/tsc-baseline.txt`. Expected: identical to baseline.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in as any existing user with a `profiles` row, navigate to the page that renders `<ReferralsPage />` (check `src/components/layout/Sidebar.tsx` or search for where `ReferralsPage` is imported to find the route), and confirm the description reads "first 6 months" (the default). This cannot be fully verified for a partner account until Task 9's admin endpoint exists to flag one — note that in the report rather than skipping verification entirely.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/referrals/me/route.ts src/components/ReferralsPage.tsx
git commit -m "referrals: show the viewer's actual commission window instead of a hardcoded 6 months"
```

---

### Task 9: Admin partner-management endpoint

**Files:**
- Create: `src/app/api/referrals/admin/partners/route.ts` (POST handler in this task; Task 10 adds a GET handler to the same file)

**Interfaces:**
- Consumes: `ADMIN_EMAILS` pattern (Global Constraints); the shared, now-exported `adminClient()` service-role helper from `src/lib/referrals.ts` (Task 3 exports it — this task must run after Task 3).
- Produces: `POST /api/referrals/admin/partners` — request body `{ email: string; code: string }`, consumed by Task 10's admin page.

- [ ] **Step 1: Write the endpoint**

`src/app/api/referrals/admin/partners/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
const VANITY_CODE_RE = /^[a-z0-9-]{3,20}$/

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.email !== 'string' || typeof body.code !== 'string') {
    return NextResponse.json({ error: 'email and code are required' }, { status: 400 })
  }

  const normalizedCode = body.code.trim().toLowerCase()
  if (!VANITY_CODE_RE.test(normalizedCode)) {
    return NextResponse.json({ error: 'Code must be 3-20 lowercase letters, numbers, or hyphens' }, { status: 400 })
  }

  const admin = adminClient()

  // profiles has no email column -- resolve the target user via auth admin.
  // listUsers() is unpaginated here by default (first page only), which is
  // fine at the partner-program's expected scale (a handful of partners);
  // revisit if the user base grows large enough that a partner's account
  // might be past the first page.
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })

  const target = usersPage.users.find(u => (u.email || '').toLowerCase() === body.email.trim().toLowerCase())
  if (!target) return NextResponse.json({ error: 'No account with that email' }, { status: 404 })

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ is_partner: true, referral_code: normalizedCode, commission_months: 12 })
    .eq('id', target.id)

  if (updateErr) {
    if (updateErr.code === '23505') {
      return NextResponse.json({ error: 'That code is already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: target.id, code: normalizedCode })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` and compare against `.superpowers/sdd/tsc-baseline.txt`. Expected: identical to baseline.

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Using a REST client (or `curl`) while signed in as a non-admin user, POST to `http://localhost:3000/api/referrals/admin/partners` with `{"email":"someone@example.com","code":"testcode"}` and a session cookie — expect `403`. This route needs a real browser session cookie to test properly; if curl-based testing is impractical without one, defer full verification to Task 10's page (which exercises this endpoint from the browser) and note that in the report.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/referrals/admin/partners/route.ts
git commit -m "admin: add partner assignment endpoint (vanity code + 12-month window)"
```

---

### Task 10: Admin partners dashboard

**Files:**
- Modify: `src/app/api/referrals/admin/partners/route.ts` (add a GET handler alongside Task 9's POST)
- Create: `src/app/api/referrals/admin/partners/[id]/route.ts`
- Create: `src/app/admin/partners/page.tsx`

**Interfaces:**
- Consumes: `POST /api/referrals/admin/partners` (Task 9).
- Produces: `GET /api/referrals/admin/partners` (rollup list), `GET /api/referrals/admin/partners/[id]` (single partner + full ledger) — used only by this task's page.

- [ ] **Step 1: Add the GET handler for the partner rollup list**

In `src/app/api/referrals/admin/partners/route.ts`, add (alongside the existing `POST`, using the same `ADMIN_EMAILS` check and a plain session client since this only reads):

```ts
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data: partners } = await supabase
    .from('profiles')
    .select('id, first_name, referral_code, commission_rate, commission_months')
    .eq('is_partner', true)

  const partnerIds = (partners || []).map(p => p.id)
  const emptyIdList = ['00000000-0000-0000-0000-000000000000']

  const { data: commissions } = await supabase
    .from('referral_commissions')
    .select('referrer_id, gross_amount, commission_amount, status, available_at')
    .in('referrer_id', partnerIds.length ? partnerIds : emptyIdList)

  const { data: referredCounts } = await supabase
    .from('profiles')
    .select('referred_by')
    .in('referred_by', partnerIds.length ? partnerIds : emptyIdList)

  const now = Date.now()
  const rows = commissions || []

  const result = (partners || []).map(p => {
    const own = rows.filter(r => r.referrer_id === p.id)
    const grossTotal = own.reduce((s, r) => s + Number(r.gross_amount), 0)
    const commissionTotal = own.reduce((s, r) => s + Number(r.commission_amount), 0)
    const owed = own
      .filter(r => r.status === 'pending' && new Date(r.available_at).getTime() <= now)
      .reduce((s, r) => s + Number(r.commission_amount), 0)
    const paid = own
      .filter(r => r.status === 'paid')
      .reduce((s, r) => s + Number(r.commission_amount), 0)
    const signups = (referredCounts || []).filter(r => r.referred_by === p.id).length

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
  })

  return NextResponse.json({ partners: result })
}
```

- [ ] **Step 2: Write the per-partner ledger detail route**

`src/app/api/referrals/admin/partners/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data: partner } = await supabase
    .from('profiles')
    .select('id, first_name, referral_code, commission_rate, commission_months')
    .eq('id', params.id)
    .eq('is_partner', true)
    .maybeSingle()

  if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

  const { data: ledger } = await supabase
    .from('referral_commissions')
    .select('*')
    .eq('referrer_id', params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ partner, ledger: ledger || [] })
}
```

- [ ] **Step 3: Write the admin page**

`src/app/admin/partners/page.tsx` (mirrors the existing `src/app/admin/referrals/page.tsx`'s inline-style, single-file pattern — no shared component library exists for admin screens in this repo, so introducing one here would be inconsistent with the codebase):

```tsx
'use client'

import { useState, useEffect } from 'react'

type Partner = {
  id: string
  name: string
  code: string | null
  rate: number
  months: number
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

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [formMessage, setFormMessage] = useState<string | null>(null)

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

  const usd = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D11', color: '#fff', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Affiliate Partners</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '28px' }}>
          Partners earn 20% for 12 months (vs. the standard 6-month friend program). Assign a vanity code below, then track owed/paid per partner.
        </p>

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
                    <div style={{ fontSize: '11px', color: '#888' }}>{p.signups} signups &middot; {(p.rate * 100).toFixed(0)}% for {p.months}mo</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>Owed {usd(p.owed)}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Paid {usd(p.paid)} &middot; Gross {usd(p.grossTotal)}</div>
                  </div>
                </div>
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

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` and compare against `.superpowers/sdd/tsc-baseline.txt`. Expected: identical to baseline.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, sign in with an email listed in `ADMIN_EMAILS` (check `.env.local` for the current value — do not print its contents, just confirm you have such an account), navigate to `http://localhost:3000/admin/partners`. Confirm: the page loads with "No partners yet."; submitting the create-partner form with a real user's email and a code like `test-partner-1` succeeds and the partner appears in the list; clicking the partner row expands an (empty) ledger table; submitting a duplicate code for a second user returns "That code is already taken."; signing in as a non-`ADMIN_EMAILS` user and visiting `/admin/partners` shows the page shell but the fetches return "Not authorized" (matches the existing `/admin/referrals` page's error handling — this task does not add page-level route protection beyond what that existing page already has, per the Global Constraints).

Clean up the test partner afterward via `execute_sql` (Supabase MCP) against the confirmed `PROJECT_ID`:

```sql
update public.profiles set is_partner = false, referral_code = null, commission_months = 6
where referral_code = 'test-partner-1';
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/referrals/admin/partners/route.ts src/app/api/referrals/admin/partners/\[id\]/route.ts src/app/admin/partners/page.tsx
git commit -m "admin: add partners dashboard (rollup list, per-partner ledger, create form)"
```

---

### Task 11: End-to-end verification with Stripe CLI

**Files:** none created — this task seeds data and drives real Stripe test-mode events against the local dev server.

**Interfaces:** consumes everything from Tasks 1-10; produces the proof the full flow works together.

- [ ] **Step 1: Safety check**

Open `.env.local` and confirm `STRIPE_SECRET_KEY` starts with `sk_test_` and `STRIPE_WEBHOOK_SECRET` is set. If `STRIPE_SECRET_KEY` starts with `sk_live_`, STOP — do not proceed with this task, escalate to the user instead.

- [ ] **Step 2: Start the dev server and Stripe CLI listener**

In one terminal: `npm run dev` (leave running).
In another: `stripe listen --forward-to localhost:3000/api/stripe/webhook --print-json` (leave running; `--print-json` prints each event's full payload to this terminal, which is how you'll read the real customer/invoice/charge/event ids Stripe generates in the steps below — no source-code debug logging needed). It also prints a webhook signing secret starting `whsec_` — if it differs from `.env.local`'s `STRIPE_WEBHOOK_SECRET`, temporarily update `.env.local` to match it for this session, then restart `npm run dev`.

**Important:** `stripe trigger` creates its own real Stripe test-mode fixtures (customer, subscription, invoice) with real auto-generated ids — it does NOT let you inject an arbitrary pre-existing customer id into most event types. So the sequence below is: (1) fire the event first with whatever fixture Stripe generates, (2) read the real ids it created from the `--print-json` output, (3) point a seeded Supabase profile at those real ids, (4) use `stripe events resend <event_id>` to redeliver the SAME event now that the profile matches — this also doubles as your idempotency check when you resend a second time.

- [ ] **Step 3: Seed a partner**

Via Supabase MCP `execute_sql` against the confirmed `PROJECT_ID` (use any existing real profile — this is temporary and reverted in Step 11):

```sql
update public.profiles
set is_partner = true, referral_code = 'e2e-partner-test', commission_months = 12
where id = '<PARTNER_PROFILE_ID>';
```

- [ ] **Step 4: Fire a real `invoice.paid` event and capture its ids**

```bash
stripe trigger invoice.paid
```

In the `stripe listen --print-json` terminal, find the `invoice.paid` event payload and record: the event id (`evt_...`), `data.object.customer` (`cus_...`), `data.object.id` (the invoice id, `in_...`), and `data.object.amount_paid` (integer cents). Call these `EVENT_ID`, `CUSTOMER_ID`, `INVOICE_ID`, `AMOUNT_PAID_CENTS`.

Check the `npm run dev` terminal: since no profile has `stripe_customer_id = CUSTOMER_ID` yet, the handler's `if (!payer || !payer.referred_by) break` fires — no error, no row written. This first delivery is expected to no-op; that's why Step 6 redelivers it.

- [ ] **Step 5: Point a referred profile at the real customer id**

```sql
update public.profiles
set referred_by = '<PARTNER_PROFILE_ID>', stripe_customer_id = '<CUSTOMER_ID>'
where id = '<REFERRED_PROFILE_ID>';
```

- [ ] **Step 6: Redeliver the event — commission should now be written**

```bash
stripe events resend <EVENT_ID>
```

Via `execute_sql`:

```sql
select stripe_invoice_id, gross_amount, commission_amount, program, status
from public.referral_commissions
where referrer_id = '<PARTNER_PROFILE_ID>'
order by created_at desc limit 1;
```

Expected: one row, `stripe_invoice_id = '<INVOICE_ID>'`, `commission_amount` = 20% of `AMOUNT_PAID_CENTS / 100` (rounded to cents — compute the expected value from the real amount Stripe's fixture generated, since that amount is not something you control), `program = 'partner'`, `status = 'pending'`.

- [ ] **Step 7: Redeliver the same event again — idempotency check**

```bash
stripe events resend <EVENT_ID>
```

Verify: `select count(*) from public.referral_commissions where stripe_invoice_id = '<INVOICE_ID>';` → still `1` (the upsert on `stripe_invoice_id` deduped it).

- [ ] **Step 8: Verify friend referrals are unaffected**

Repeat Steps 4-6 for a second, independent `invoice.paid` trigger, but in Step 5 point a THIRD throwaway profile's `referred_by` at any account with `is_partner = false` (a friend referrer) instead of the partner. Expected after redelivery: a new row with `program = 'friend'` and `commission_amount` = 20% of that second invoice's amount, unaffected by anything partner-related.

- [ ] **Step 9: Trigger a real refund on the partner's invoice**

Find the charge behind the invoice from Step 4:

```bash
stripe invoices retrieve <INVOICE_ID>
```

Record its `charge` field as `CHARGE_ID`. If the response has no top-level `charge` field (depends on the Stripe account's default API version — newer versions route through PaymentIntents), instead read `payment_intent`, then run `stripe payment_intents retrieve <payment_intent_id>` and record its `latest_charge` field as `CHARGE_ID`. Then issue a real full refund:

```bash
stripe refunds create --charge <CHARGE_ID>
```

In the `stripe listen --print-json` terminal, find the resulting `charge.refunded` event, confirm `data.object.amount_refunded` equals `data.object.amount` (full refund), and record the event id as `REFUND_EVENT_ID`.

Via `execute_sql`:

```sql
select stripe_invoice_id, gross_amount, commission_amount, reversal_of
from public.referral_commissions
where referrer_id = '<PARTNER_PROFILE_ID>'
order by created_at desc limit 1;
```

Expected: a new row, `stripe_invoice_id = 'refund_<CHARGE_ID>'`, `gross_amount` and `commission_amount` the exact negatives of the Step 6 row's values, `reversal_of` set to the Step 6 row's id.

- [ ] **Step 10: Redeliver the refund event — idempotency check**

```bash
stripe events resend <REFUND_EVENT_ID>
```

Verify: `select count(*) from public.referral_commissions where stripe_invoice_id = 'refund_<CHARGE_ID>';` → still `1`.

- [ ] **Step 11: Verify via the admin dashboard**

Navigate to `http://localhost:3000/admin/partners` (signed in as an `ADMIN_EMAILS` account). Confirm the partner row's net commission reflects Steps 6 and 9 netting to zero, and expanding the row shows both ledger entries (the original and its reversal).

- [ ] **Step 12: Verify the referrer's own page shows partner copy**

Sign in as the partner account, navigate to the referrals page, confirm the description reads "first 12 months" (not 6).

- [ ] **Step 13: Clean up all test data**

```sql
delete from public.referral_commissions
where stripe_invoice_id in ('<INVOICE_ID>', 'refund_<CHARGE_ID>')
   or referrer_id in ('<PARTNER_PROFILE_ID>');

update public.profiles set is_partner = false, referral_code = null, commission_months = 6, referred_by = null, stripe_customer_id = null
where id in ('<PARTNER_PROFILE_ID>', '<REFERRED_PROFILE_ID>');
```

Also revert the Step 8 throwaway profile's `referred_by`/`stripe_customer_id` and delete its commission row the same way. Confirm afterward: `select count(*) from public.referral_commissions where referrer_id in ('<PARTNER_PROFILE_ID>');` → `0`.

- [ ] **Step 14: Stop the CLI listener and dev server**

Stop both background processes from Step 2. If `.env.local`'s `STRIPE_WEBHOOK_SECRET` was temporarily changed in Step 2, revert it to its original value.

No commit for this task — it produces no file changes, only verification evidence for the final report.
