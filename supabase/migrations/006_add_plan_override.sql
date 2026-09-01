-- Manual/founder plan overrides. Some profiles.plan values are not backed by
-- a real Stripe subscription (comp accounts, founder accounts, support
-- grants) -- vermonski@gmail.com is one today (plan=elite, active, but
-- stripe_subscription_id is NULL). Nothing currently stops the Stripe
-- webhook or /api/stripe/sync from silently overwriting such a row the next
-- time a Stripe event happens to reference that user, or from a future
-- subscription being attached to it.
--
-- plan_override, when true, marks a profile as manually managed: the Stripe
-- webhook (src/app/api/stripe/webhook/route.ts) and /api/stripe/sync
-- (src/app/api/stripe/sync/route.ts) must check this flag and skip writing
-- plan/subscription_status for that row, no matter what Stripe says.
--
-- No RLS/grant change needed: migration 004_lock_profiles_privilege_columns
-- already revoked UPDATE on all non-whitelisted profiles columns from
-- anon/authenticated, and these new columns are not added to that
-- whitelist -- only the service-role client (or direct SQL) can set them,
-- same as plan/subscription_status/stripe_* already are.

alter table public.profiles
  add column if not exists plan_override boolean not null default false,
  add column if not exists plan_override_note text,
  add column if not exists plan_override_at timestamptz;

comment on column public.profiles.plan_override is
  'True = plan/subscription_status are set manually (founder/comp/support grant), not derived from a real Stripe subscription. The Stripe webhook and /api/stripe/sync must skip plan writes for this row when true.';
comment on column public.profiles.plan_override_note is
  'Free-text reason/owner/date for the manual override, for audit purposes.';
comment on column public.profiles.plan_override_at is
  'When the manual override was last set.';
