-- 012_ai_chat_sessions.sql
-- Persistent per-session Sleek AI chat history (src/components/AIAnalysis.tsx).
-- Previously "New chat" just cleared local component state, silently
-- discarding the prior conversation instead of starting a new one alongside
-- it (BUG-SAI-004). Each row is one conversation; messages are stored as a
-- single jsonb array since a chat is always read/written as a whole.

create table if not exists ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_chat_sessions_user_id_updated_at_idx
  on ai_chat_sessions(user_id, updated_at desc);

alter table ai_chat_sessions enable row level security;

create policy "own chat sessions only" on ai_chat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger ai_chat_sessions_updated_at
  before update on ai_chat_sessions
  for each row execute procedure public.handle_updated_at();
