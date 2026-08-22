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
