-- ============================================================
-- TRADEBOOK — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already enabled by default on Supabase)
create extension if not exists "uuid-ossp";

-- ─── TRADES ─────────────────────────────────────────────────────────────────
create table public.trades (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  symbol        text not null,
  type          text not null default 'Long',   -- 'Long' | 'Short'
  date          timestamptz not null,
  exit_date     timestamptz,

  entry         numeric(12,4) not null default 0,
  exit          numeric(12,4) default 0,
  shares        numeric(12,4) default 0,
  pnl           numeric(12,2) not null default 0,
  risk          numeric(12,2) default 0,
  commission    numeric(12,2) default 0,

  setup         text,
  grade         text,
  tags          text[] default '{}',
  notes         text,
  screenshot_url text,   -- path in Supabase Storage

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── NOTES ──────────────────────────────────────────────────────────────────
create table public.notes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  category      text not null default 'my',    -- 'trade' | 'my'
  title         text not null default 'Untitled',
  body          text not null default '',
  img_url       text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── STRATEGIES ─────────────────────────────────────────────────────────────
create table public.strategies (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  name          text not null,
  rules         text,
  img_url       text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- Users can only see and modify their OWN data. Critical.

alter table public.trades     enable row level security;
alter table public.notes      enable row level security;
alter table public.strategies enable row level security;

-- Trades policies
create policy "trades: select own"
  on public.trades for select
  using (auth.uid() = user_id);

create policy "trades: insert own"
  on public.trades for insert
  with check (auth.uid() = user_id);

create policy "trades: update own"
  on public.trades for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trades: delete own"
  on public.trades for delete
  using (auth.uid() = user_id);

-- Notes policies
create policy "notes: select own"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "notes: insert own"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "notes: update own"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notes: delete own"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Strategies policies
create policy "strategies: select own"
  on public.strategies for select
  using (auth.uid() = user_id);

create policy "strategies: insert own"
  on public.strategies for insert
  with check (auth.uid() = user_id);

create policy "strategies: update own"
  on public.strategies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "strategies: delete own"
  on public.strategies for delete
  using (auth.uid() = user_id);

-- ─── INDEXES ────────────────────────────────────────────────────────────────
-- Speed up the most common queries

create index trades_user_id_idx    on public.trades(user_id);
create index trades_date_idx       on public.trades(user_id, date desc);
create index trades_symbol_idx     on public.trades(user_id, symbol);
create index notes_user_id_idx     on public.notes(user_id);
create index strategies_user_id_idx on public.strategies(user_id);

-- ─── AUTO-UPDATE updated_at ─────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trades_updated_at
  before update on public.trades
  for each row execute procedure public.handle_updated_at();

create trigger notes_updated_at
  before update on public.notes
  for each row execute procedure public.handle_updated_at();

create trigger strategies_updated_at
  before update on public.strategies
  for each row execute procedure public.handle_updated_at();

-- ─── STORAGE BUCKETS ────────────────────────────────────────────────────────
-- Run separately in SQL Editor after creating buckets in Storage UI
-- OR run here to create them programmatically

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('screenshots', 'screenshots', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('note-images', 'note-images', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('strategy-images', 'strategy-images', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- Storage policies (users access only their own files)
create policy "screenshots: user access"
  on storage.objects for all
  using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "note-images: user access"
  on storage.objects for all
  using (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "strategy-images: user access"
  on storage.objects for all
  using (bucket_id = 'strategy-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'strategy-images' and auth.uid()::text = (storage.foldername(name))[1]);
