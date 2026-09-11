import { createClient } from '@/lib/supabase/client'
import type { AiChatSessionRow, AiChatMessage } from '@/lib/types'

// List view only needs enough to render the sidebar — excluding `messages`
// keeps this cheap even once a user has a long chat history.
export type AiChatSessionSummary = Pick<AiChatSessionRow, 'id' | 'title' | 'created_at' | 'updated_at'>

// Returns whether the fetch itself failed, not just an empty result — a
// real fetch failure (RLS/network/session) and "you have no chat history
// yet" used to render identically (an empty sidebar), which is exactly the
// ambiguity a report of "no history panel at all" turned out to hinge on:
// the writes were confirmed to be landing in the DB, so the sidebar was
// either failing silently to read them back or a stale view just hadn't
// refetched. Surfacing the difference in the UI (AIAnalysis.tsx) makes the
// next report of this conclusive either way instead of another guess.
export async function fetchChatSessions(): Promise<{ sessions: AiChatSessionSummary[]; error: boolean }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) { console.error(error); return { sessions: [], error: true } }
  return { sessions: data || [], error: false }
}

export async function fetchChatSession(id: string): Promise<AiChatSessionRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) { console.error(error); return null }
  return data
}

// Title defaults to the first user message, trimmed — same idea as email
// clients deriving a thread subject from the first line.
export function deriveChatTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, ' ')
  return trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed
}

export async function createChatSession(userId: string, messages: AiChatMessage[]): Promise<AiChatSessionRow | null> {
  const supabase = createClient()
  const title = messages.find(m => m.role === 'user')?.content
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .insert({ user_id: userId, messages, title: title ? deriveChatTitle(title) : null })
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updateChatSessionMessages(id: string, messages: AiChatMessage[]): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('ai_chat_sessions')
    .update({ messages })
    .eq('id', id)
  return !error
}

export async function deleteChatSession(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('ai_chat_sessions').delete().eq('id', id)
  return !error
}
