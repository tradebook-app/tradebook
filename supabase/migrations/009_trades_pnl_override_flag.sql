-- 009_trades_pnl_override_flag.sql
-- Pre-launch audit fix: effectivePnl() previously trusted ANY non-zero stored
-- pnl forever, with no way to tell "the user deliberately overrode this" apart
-- from "this is stale/wrong data" (a bad import, or a stored value left behind
-- after commission was corrected without recomputing pnl). Live-DB recompute
-- found 63/163 real trades in this state.
--
-- pnl_is_override makes that distinction explicit: true only when the user
-- actually typed a value into the P&L Override field that differs from what
-- entry/exit/shares/commission would compute. Everything else (broker
-- imports, plain entry, historical rows) defaults to false and is safe to
-- recompute from the fills whenever the fills allow it.

alter table public.trades
  add column if not exists pnl_is_override boolean not null default false;
