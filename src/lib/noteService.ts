import { createClient } from '@/lib/supabase/client'
import type { NoteRow, NoteInsert, NoteUpdate } from '@/lib/types'

// Whether a note should be visible when `accountId` is the selected account.
// Unlike trades (an exact account_id match only), a note with no account_id
// — every note that predates account-scoping, plus any saved with no
// account selected — is visible under EVERY account rather than hidden:
// silently disappearing someone's existing notes because they predate this
// feature would be worse than occasionally showing one under an account it
// isn't strictly assigned to.
export function isNoteInAccount(note: Pick<NoteRow, 'account_id'>, accountId: string | null): boolean {
  return note.account_id === accountId || note.account_id == null
}

export async function fetchNotes(): Promise<NoteRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function insertNote(note: NoteInsert, userId: string): Promise<NoteRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .insert({ ...note, user_id: userId })
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updateNote(id: string, updates: NoteUpdate): Promise<NoteRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function deleteNote(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  return !error
}

export async function uploadNoteImage(file: File, userId: string): Promise<string | null> {
  const supabase = createClient()
  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('note-images').upload(path, file, { upsert: true })
  if (error) { console.error(error); return null }
  return path
}

export async function getNoteImageUrl(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.storage.from('note-images').createSignedUrl(path, 3600)
  return data?.signedUrl || null
}
