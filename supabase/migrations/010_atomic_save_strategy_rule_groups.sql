-- 010_atomic_save_strategy_rule_groups.sql
-- Pre-launch audit fix: saveRuleGroups() (strategyService.ts) replaced a
-- strategy's rule groups with three separate client-side calls — DELETE all
-- existing groups (cascades to rules), then INSERT the new groups, then
-- INSERT the new rules. Nothing tied those three calls together: a network
-- hiccup, a closed tab, or an insert error after the delete had already
-- succeeded left the strategy with its rules permanently gone and nothing
-- reinserted — real, silent data loss with no rollback.
--
-- This function does the same delete-then-reinsert, but as the body of a
-- single Postgres function call, which Postgres always runs as one implicit
-- transaction: if anything inside raises, every effect (including the
-- delete) rolls back automatically. `security invoker` (the default, stated
-- explicitly) means it runs with the calling user's privileges, so the
-- existing RLS policies on strategy_rule_groups/strategy_rules — ownership
-- checked via strategies.user_id = auth.uid() — apply exactly as they did
-- to the three separate calls. This function grants no new access.

create or replace function public.save_strategy_rule_groups(
  p_strategy_id uuid,
  -- [{ "name": text, "rules": [{ "text": text }, ...] }, ...], already
  -- trimmed/filtered client-side, in the order they should be saved.
  p_groups jsonb
)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.strategy_rule_groups where strategy_id = p_strategy_id;

  with new_groups as (
    insert into public.strategy_rule_groups (strategy_id, name, position)
    select p_strategy_id, g.value ->> 'name', (g.ord - 1)::int
    from jsonb_array_elements(p_groups) with ordinality as g(value, ord)
    returning id, position
  )
  insert into public.strategy_rules (group_id, text, position)
  select ng.id, r.value ->> 'text', (r.ord - 1)::int
  from jsonb_array_elements(p_groups) with ordinality as g(value, ord)
  join new_groups ng on ng.position = (g.ord - 1)::int
  cross join lateral jsonb_array_elements(g.value -> 'rules') with ordinality as r(value, ord);
end;
$$;

revoke all on function public.save_strategy_rule_groups(uuid, jsonb) from public;
grant execute on function public.save_strategy_rule_groups(uuid, jsonb) to authenticated;
