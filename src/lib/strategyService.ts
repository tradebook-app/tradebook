import { createClient } from '@/lib/supabase/client'
import type {
  StrategyRow, StrategyInsert, StrategyUpdate,
  StrategyRuleGroupWithRules, StrategyRuleGroupDraft,
} from '@/lib/types'

// ─── Strategies ───────────────────────────────────────────────────────────────

export async function fetchStrategies(): Promise<StrategyRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function insertStrategy(strategy: StrategyInsert, userId: string): Promise<StrategyRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('strategies')
    .insert({ ...strategy, user_id: userId })
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updateStrategy(id: string, updates: StrategyUpdate): Promise<StrategyRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('strategies')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function deleteStrategy(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('strategies').delete().eq('id', id)
  return !error
}

export async function uploadStrategyImage(file: File, userId: string): Promise<string | null> {
  const supabase = createClient()
  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('strategy-images').upload(path, file, { upsert: true })
  if (error) { console.error(error); return null }
  return path
}

export async function getStrategyImageUrl(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.storage.from('strategy-images').createSignedUrl(path, 3600)
  return data?.signedUrl || null
}

// ─── Rule groups + rules ────────────────────────────────────────────────────
// Rules are edited as a whole per strategy (add/remove/reorder groups and
// rules freely in the UI, then save once) rather than one network call per
// rule — simpler state to manage and fewer round trips.

export async function fetchRuleGroups(strategyId: string): Promise<StrategyRuleGroupWithRules[]> {
  const supabase = createClient()
  const { data: groups, error: gErr } = await supabase
    .from('strategy_rule_groups')
    .select('*')
    .eq('strategy_id', strategyId)
    .order('position', { ascending: true })
  if (gErr || !groups) { console.error(gErr); return [] }
  if (groups.length === 0) return []

  const { data: rules, error: rErr } = await supabase
    .from('strategy_rules')
    .select('*')
    .in('group_id', groups.map(g => g.id))
    .order('position', { ascending: true })
  if (rErr) { console.error(rErr); return groups.map(g => ({ ...g, rules: [] })) }

  return groups.map(g => ({
    ...g,
    rules: (rules || []).filter(r => r.group_id === g.id),
  }))
}

// Replaces ALL rule groups/rules for a strategy with the given draft state.
// Simplest correct approach for this scale: wipe the strategy's existing
// groups (cascades to rules) and reinsert fresh, preserving order.
export async function saveRuleGroups(strategyId: string, groups: StrategyRuleGroupDraft[]): Promise<boolean> {
  const supabase = createClient()

  const { error: delErr } = await supabase
    .from('strategy_rule_groups')
    .delete()
    .eq('strategy_id', strategyId)
  if (delErr) { console.error(delErr); return false }

  const cleanGroups = groups
    .map(g => ({ ...g, name: g.name.trim(), rules: g.rules.filter(r => r.text.trim()) }))
    .filter(g => g.name)
  if (cleanGroups.length === 0) return true

  const { data: insertedGroups, error: gErr } = await supabase
    .from('strategy_rule_groups')
    .insert(cleanGroups.map((g, i) => ({ strategy_id: strategyId, name: g.name, position: i })))
    .select()
  if (gErr || !insertedGroups) { console.error(gErr); return false }

  const ruleRows = cleanGroups.flatMap((g, gi) =>
    g.rules.map((r, ri) => ({
      group_id: insertedGroups[gi].id,
      text: r.text.trim(),
      position: ri,
    }))
  )
  if (ruleRows.length === 0) return true

  const { error: rErr } = await supabase.from('strategy_rules').insert(ruleRows)
  if (rErr) { console.error(rErr); return false }

  return true
}
