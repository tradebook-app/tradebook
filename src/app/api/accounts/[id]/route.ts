import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { name, broker } = await request.json()
  const updates: Record<string, any> = {}
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Account name cannot be empty.' }, { status: 400 })
    updates.name = name.trim()
  }
  if (broker !== undefined) updates.broker = broker?.trim() || null

  const { data, error } = await supabase
    .from('trading_accounts')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id) // RLS also enforces this, belt-and-suspenders
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Don't allow deleting your only account — trades would be orphaned with
  // nowhere to reassign, and everyone must have at least 1 account.
  const { count } = await supabase
    .from('trading_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count || 0) <= 1) {
    return NextResponse.json({ error: 'You must have at least one trading account.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('trading_accounts')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
