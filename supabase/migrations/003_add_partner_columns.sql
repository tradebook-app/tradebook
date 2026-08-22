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
