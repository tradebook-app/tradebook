-- 008_ai_analysis_usage.sql
-- Per-user daily rate limiting for the Sleek AI endpoint
-- (src/app/api/ai-analysis/route.ts), mirroring support_chat_usage.

create table if not exists ai_analysis_usage (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, day)
);

alter table ai_analysis_usage enable row level security;

create policy "own usage only" on ai_analysis_usage
  for all using (auth.uid() = user_id);
