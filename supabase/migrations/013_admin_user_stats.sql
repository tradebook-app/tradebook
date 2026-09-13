-- 013_admin_user_stats.sql
-- Backs the /admin/users dashboard (src/app/api/admin/users/route.ts).
--
-- Email lives in auth.users, not public.profiles, and auth.users isn't
-- reachable through the normal PostgREST client even with the service-role
-- key (only the public schema is exposed that way) — so this is exposed as
-- a security definer function instead of a plain table query. Only the
-- service role may execute it; the route itself gates on ADMIN_EMAILS
-- before ever calling it, same as every other /api/*/admin/* route.
create or replace function admin_user_stats()
returns table (
  id uuid,
  email text,
  plan text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email, coalesce(p.plan, 'free') as plan, u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc
$$;

revoke all on function admin_user_stats() from public;
grant execute on function admin_user_stats() to service_role;
