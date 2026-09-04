import { createClient } from '@/lib/supabase/client'
import type { TradeRow, TradeInsert, TradeUpdate } from '@/lib/types'
import { effectivePnl } from '@/lib/analytics'

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

// Upload several screenshots at once; returns the paths that succeeded, in order.
export async function uploadScreenshots(files: File[], userId: string): Promise<string[]> {
  const results = await Promise.all(files.map(f => uploadScreenshot(f, userId)))
  return results.filter((p): p is string => !!p)
}

// Remove screenshots from storage (best effort — a failure here shouldn't block
// saving the trade).
export async function deleteScreenshots(paths: string[]): Promise<void> {
  if (!paths.length) return
  const supabase = createClient()
  const { error } = await supabase.storage.from('screenshots').remove(paths)
  if (error) console.error('Delete screenshots error:', error)
}

// screenshot_urls is authoritative; fall back to the legacy single column, and
// always keep screenshot_url mirroring the first entry.
function normalizeShots<T extends { screenshot_url: string | null; screenshot_urls?: string[] | null }>(t: T): T {
  const urls = (t.screenshot_urls && t.screenshot_urls.length)
    ? t.screenshot_urls
    : (t.screenshot_url ? [t.screenshot_url] : [])
  return { ...t, screenshot_urls: urls, screenshot_url: urls[0] ?? null }
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
  // Heal rows whose stored pnl is a wrong 0 (bad import / stale override) so
  // every consumer sees the correct figure. Non-destructive — the DB row is
  // only rewritten on the next real save.
  return (data || []).map(t => normalizeShots({ ...t, pnl: effectivePnl(t) }))
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
  return data ? normalizeShots({ ...data, pnl: effectivePnl(data) }) : null
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
  if (!data) return null

  // Defense in depth for a bug where setup/strategy_id weren't persisting on
  // some saves with no client-visible error: PostgREST can return 200 with a
  // row whose fields don't match what was actually sent (a policy or trigger
  // silently ignoring a column, a stale read-back, etc). Compare what we sent
  // against what came back for those two fields specifically, and treat a
  // mismatch as a failed save instead of reporting success with wrong data.
  const checkedFields = ['setup', 'strategy_id'] as const
  const mismatches = checkedFields.filter(k => k in updates && updates[k] !== data[k])
  if (mismatches.length) {
    console.error('Update trade mismatch — sent vs. stored differ:', {
      id,
      sent:   Object.fromEntries(mismatches.map(k => [k, updates[k]])),
      stored: Object.fromEntries(mismatches.map(k => [k, data[k]])),
    })
    return null
  }

  return normalizeShots({ ...data, pnl: effectivePnl(data) })
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
