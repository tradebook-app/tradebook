-- SECURITY: fix two independent problems on public.profiles found while
-- building the partner-affiliate feature (partner-affiliate-system branch,
-- Task 1's investigation).
--
-- 1. A policy named "Service role full access" is actually
--    `ALL, TO public, USING (true), WITH CHECK (true)` -- unconditional,
--    granted to public (not scoped to the service_role connection), so any
--    caller -- authenticated OR anonymous -- can read/write/delete ANY row.
--    This was also unnecessary: Supabase's service-role Postgres role has
--    BYPASSRLS, so a policy granting it access was never needed.
--
-- 2. Even with that policy removed, RLS is row-level only. The existing
--    "Users can update own profile" policy (auth.uid() = id) correctly
--    restricts WHICH ROW a signed-in user can touch, but not WHICH COLUMNS
--    -- and profiles carries privilege-bearing columns (subscription
--    plan/status, Stripe ids, and the partner-affiliate branch's new
--    is_partner/commission_rate/commission_months) alongside genuine
--    self-service preference fields. Supabase's default table-wide grants
--    meant any signed-in user could PATCH their own `plan` to 'pro', their
--    `subscription_status` to 'active', or grant themselves `is_partner`
--    with a 100% `commission_rate`, entirely bypassing Stripe and the
--    admin-only partner endpoint.
--
-- Fix: drop the bad policy, then revoke the blanket INSERT/UPDATE grants
-- and re-grant UPDATE only on the columns genuinely meant for client
-- self-service. INSERT is not re-granted at all: every user's profiles row
-- is auto-created by the SECURITY DEFINER trigger `handle_new_user()` on
-- signup (confirmed live), so no client-scoped INSERT is ever legitimate.
-- Server-computed values (Stripe ids/status/plan) now write via the
-- service-role client instead (src/app/api/stripe/{checkout,sync}/route.ts,
-- companion change to this migration) -- matching the pattern already used
-- by the Stripe webhook and the partner-admin endpoints.

drop policy if exists "Service role full access" on public.profiles;

revoke insert, update on public.profiles from anon, authenticated;

-- Exactly the columns genuinely written by a signed-in user's own session,
-- confirmed by an audit of every profiles write in the codebase:
--   first_name, last_name, bio, avatar_url, trader_types -> Settings.tsx
--   has_seen_intro                                        -> OnboardingTour.tsx
--   referral_code                                          -> ensureReferralCode()
--     (self-service code minting on first visit to the referrals page)
-- anon deliberately gets no grant: an unauthenticated caller can't pass the
-- RLS auth.uid() = id check anyway, and nothing legitimate updates as anon.
grant update (
  first_name,
  last_name,
  bio,
  avatar_url,
  trader_types,
  has_seen_intro,
  referral_code
) on public.profiles to authenticated;
