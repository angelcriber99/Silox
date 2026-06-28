"use server"

import { createClient } from '@/lib/supabase/server'
import { EventoRecurrenteSchema } from '@/lib/validations/schemas'
import type { EventoRecurrente } from '@/lib/types'

export async function insertEventoRecurrenteAction(formData: unknown): Promise<EventoRecurrente> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const validatedData = EventoRecurrenteSchema.parse(formData)

  const { data: asset, error: assetError } = await supabase
    .from('activos')
    .select('id')
    .eq('id', validatedData.activo_id)
    .eq('user_id', user.id)
    .single()

  if (assetError || !asset) throw new Error('Activo no encontrado o no autorizado')

  const { data, error } = await supabase
    .from('eventos_recurrentes')
    .insert([{ ...validatedData, user_id: user.id }])
    .select('*, activo:activos(ticker, nombre, tipo)')
    .single()

  if (error) throw new Error(`Error insertando evento recurrente: ${error.message}`)
  return data as EventoRecurrente
}

export async function updateEventoRecurrenteAction(id: string, formData: unknown): Promise<EventoRecurrente> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const validatedData = EventoRecurrenteSchema.partial().parse(formData)

  const { data, error } = await supabase
    .from('eventos_recurrentes')
    .update(validatedData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, activo:activos(ticker, nombre, tipo)')
    .single()

  if (error) throw new Error(`Error actualizando evento recurrente: ${error.message}`)
  return data as EventoRecurrente
}

export async function deleteEventoRecurrenteAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('eventos_recurrentes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Error eliminando evento recurrente: ${error.message}`)
}
