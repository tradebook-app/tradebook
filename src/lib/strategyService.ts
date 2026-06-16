import { createClient } from '@/lib/supabase/client'
import type { StrategyRow, StrategyInsert, StrategyUpdate } from '@/lib/types'

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
