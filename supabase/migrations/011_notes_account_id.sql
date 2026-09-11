-- 011_notes_account_id.sql
-- Makes the Notebook account-scoped, matching Trade View/Dashboard/Journal/
-- Reports: each note now optionally belongs to one trading account. Nullable
-- and ON DELETE SET NULL, mirroring trades.account_id exactly (same FK
-- target, same behavior on account deletion — the note survives, just
-- becomes unassigned rather than being deleted with the account).
--
-- Existing notes get account_id = null (the column default). The app treats
-- a null account_id as "visible under every account" rather than hidden —
-- silently disappearing someone's existing notes because they predate this
-- feature would be worse than occasionally showing one under an account it
-- doesn't strictly belong to.

alter table public.notes
  add column if not exists account_id uuid references public.trading_accounts(id) on delete set null;

create index if not exists notes_account_id_idx on public.notes(account_id);
