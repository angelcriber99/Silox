"use server"

import { createClient } from '@/lib/supabase/server'
import { AlertaSchema } from '@/lib/validations/schemas'
import type { PriceAlert } from '@/lib/api/alerts'

export async function addAlertAction(formData: unknown): Promise<PriceAlert> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const validatedData = AlertaSchema.parse(formData)

  const { data, error } = await supabase
    .from('alertas')
    .insert([{ ...validatedData, user_id: user.id }])
    .select()
    .single()

  if (error) throw new Error(`Error adding alert: ${error.message}`)
  return data as PriceAlert
}

export async function deleteAlertAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('alertas')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Error deleting alert: ${error.message}`)
}

export async function markAlertTriggeredAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('alertas')
    .update({ triggered: true })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Error marking alert as triggered: ${error.message}`)
}
