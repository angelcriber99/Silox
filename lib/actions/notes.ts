'use server'

import { createClient } from '@/lib/supabase/server'

export interface CloudNote {
  id: string
  user_id?: string
  title: string
  content: string
  updated_at: string
  created_at?: string
}

export async function fetchNotes(): Promise<CloudNote[]> {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return []
  }

  const { data, error } = await supabase
    // @ts-ignore
    .from('user_notes')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }

  return data as CloudNote[]
}

export async function syncNoteAction(note: CloudNote) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    // @ts-ignore
    .from('user_notes')
    .upsert({
      id: note.id,
      user_id: user.id,
      title: note.title,
      content: note.content,
      updated_at: new Date(note.updated_at).toISOString(),
    })

  if (error) {
    console.error('Error syncing note:', error)
    throw new Error('Failed to sync note')
  }
}

export async function deleteNoteAction(id: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    // @ts-ignore
    .from('user_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting note:', error)
    throw new Error('Failed to delete note')
  }
}
