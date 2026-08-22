-- Catch-up migration: profiles and referral_commissions were created directly
-- against the live database (Supabase dashboard) and were never committed to
-- a migration file, despite being used throughout the app. This migration
-- documents their actual live shape (introspected via Supabase MCP on
-- 2026-08-21) and is a no-op against the live database except for the fixes
-- below. If ever run against a fresh database, it recreates both tables.
--
-- RLS finding (from pg_class.relrowsecurity and pg_policies, live 2026-08-21):
-- RLS is ENABLED on both tables (relrowsecurity = true for profiles and
-- referral_commissions). This does NOT mean access is locked down:
--   - profiles has three policies: "Users can view own profile" (SELECT,
--     USING auth.uid() = id), "Users can update own profile" (UPDATE, USING
--     auth.uid() = id), and "Service role full access" (ALL, TO public,
--     USING true, WITH CHECK true). Despite its name, the third policy is NOT
--     scoped to the service_role -- it is granted TO public with an
--     unconditional `true` check, so it actually gives ANY caller (including
--     the anon key) unrestricted read/write/delete on every row. This is why
--     session-scoped code (e.g. src/lib/referrals.ts ensureReferralCode /
--     attributeReferral, and the Stripe webhook's profile upserts) can write
--     arbitrary profiles rows today -- not because those routes hold a
--     service-role key, but because this policy's predicate is unconditional.
--     This looks like a misconfiguration (the policy was almost certainly
--     meant to read `USING (auth.role() = 'service_role')`), but fixing it is
--     out of scope for this catch-up migration and is not touched here.
--   - referral_commissions has exactly one policy: "Users can view their own
--     referral commissions" (SELECT, USING auth.uid() = referrer_id). There is
--     NO insert/update/delete policy at all for referral_commissions. Table
--     grants show `anon` and `authenticated` hold full CRUD privileges
--     (Supabase's default), so RLS is the only gate. Concretely, this means
--     the session-scoped `/api/referrals/admin/mark-paid` UPDATE (which uses
--     the plain cookie-scoped client, not a service-role client) has no
--     applicable RLS policy and, as configured today, matches zero rows
--     rather than "succeeding on arbitrary rows" -- the route does not check
--     affected-row count, so it likely reports success while doing nothing.
--     This is a pre-existing bug independent of this task and is not fixed
--     here; flagged for follow-up.
-- Neither table's RLS/grants are altered by this migration.
--
-- Also note: this migration's illustrative column/FK targets differ from the
-- original plan draft in one respect confirmed by live introspection: the
-- referrer_id/referred_user_id/referred_by foreign keys reference
-- auth.users(id) directly (not public.profiles(id)) on the live database.
-- This migration preserves that actual live target rather than introducing an
-- unrelated structural change.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'free',
  plan text default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  first_name text,
  last_name text,
  bio text,
  avatar_url text,
  trader_types text[],
  referral_code text,
  referred_by uuid references auth.users(id),
  has_seen_intro boolean not null default false,
  newsletter_opt_in boolean default false
);

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null,
  referred_user_id uuid,
  stripe_invoice_id text not null unique,
  gross_amount numeric not null,
  commission_amount numeric not null,
  status text not null default 'pending',
  available_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referral_commissions_referrer_idx on public.referral_commissions (referrer_id);
create index if not exists referral_commissions_referred_idx on public.referral_commissions (referred_user_id);

-- Fix 1: a referred user deleting their own account (self-serve deletion
-- exists in src/components/Settings.tsx) must not erase the referrer's
-- already-earned commission history. A partner account must be settled
-- before it can be deleted at all.
-- Live constraint names/targets confirmed via pg_constraint: both FKs
-- currently reference auth.users(id) ON DELETE CASCADE. This fix changes only
-- the delete action, preserving the live reference target.
alter table public.referral_commissions
  drop constraint if exists referral_commissions_referrer_id_fkey,
  add constraint referral_commissions_referrer_id_fkey
    foreign key (referrer_id) references auth.users(id) on delete restrict;

alter table public.referral_commissions
  drop constraint if exists referral_commissions_referred_user_id_fkey,
  add constraint referral_commissions_referred_user_id_fkey
    foreign key (referred_user_id) references auth.users(id) on delete set null;

-- referred_user_id must be nullable for the "set null" above to work. Live
-- introspection showed this column as NOT NULL today; this widens it.
alter table public.referral_commissions
  alter column referred_user_id drop not null;

-- Fix 2: referral_code assignment is a check-then-insert race
-- (src/lib/referrals.ts ensureReferralCode) with no DB-level guarantee.
-- Live introspection found this unique constraint already exists
-- (profiles_referral_code_key, confirmed via pg_constraint/pg_indexes), so
-- this statement is a documenting no-op today. Kept as drop-then-add (rather
-- than omitted) so this migration is the single source of truth for the
-- constraint if ever run against a fresh database.
alter table public.profiles
  drop constraint if exists profiles_referral_code_key,
  add constraint profiles_referral_code_key unique (referral_code);
