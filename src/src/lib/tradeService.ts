import { createClient } from '@/lib/supabase/client'
import type { TradeRow, TradeInsert, TradeUpdate } from '@/lib/types'

// Upload a screenshot to Supabase Storage, return public URL
export async function uploadScreenshot(
  file: File,
  userId: string
): Promise<string | null> {
  const supabase = createClient()
  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, file, { upsert: true })

  if (error) { console.error('Upload error:', error); return null }
  return path
}

// Get signed URL for a screenshot path
export async function getScreenshotUrl(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.storage
    .from('screenshots')
    .createSignedUrl(path, 60 * 60) // 1 hour
  return data?.signedUrl || null
}

// Fetch all trades for current user, newest first
export async function fetchTrades(): Promise<TradeRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('date', { ascending: false })

  if (error) { console.error('Fetch trades error:', error); return [] }
  return data || []
}

// Insert a new trade
export async function insertTrade(
  trade: TradeInsert,
  userId: string
): Promise<TradeRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trades')
    .insert({ ...trade, user_id: userId })
    .select()
    .single()

  if (error) { console.error('Insert trade error:', error); return null }
  return data
}

// Update an existing trade
export async function updateTrade(
  id: string,
  updates: TradeUpdate
): Promise<TradeRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trades')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) { console.error('Update trade error:', error); return null }
  return data
}

// Delete a trade
export async function deleteTrade(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id)

  if (error) { console.error('Delete trade error:', error); return false }
  return true
}

// Delete multiple trades by ID
export async function deleteTrades(ids: string[]): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('trades')
    .delete()
    .in('id', ids)

  if (error) { console.error('Delete trades error:', error); return false }
  return true
}
