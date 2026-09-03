-- 007_trades_screenshot_urls.sql
-- Support multiple chart screenshots per trade (e.g. entry chart + exit chart).
-- `screenshot_url` (single) is kept as a mirror of screenshot_urls[1] so older
-- readers keep working; new code reads/writes the array.

alter table public.trades
  add column if not exists screenshot_urls text[] not null default '{}';

-- Backfill: fold the existing single screenshot into the array.
update public.trades
  set screenshot_urls = array[screenshot_url]
  where screenshot_url is not null
    and screenshot_url <> ''
    and (screenshot_urls is null or cardinality(screenshot_urls) = 0);

comment on column public.trades.screenshot_urls is
  'Storage paths (bucket: screenshots) for all chart screenshots on this trade. '
  'screenshot_url is kept as a mirror of screenshot_urls[1] for backward compatibility.';
