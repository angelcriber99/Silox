"use server"

import { createClient } from '@/lib/supabase/server'
import { ActivoSchema } from '@/lib/validations/schemas'
import type { Activo } from '@/lib/types'
import { CASH_ASSET_DEFAULTS, displayAssetType, toDatabaseAssetPayload } from '@/lib/domain/assets/normalization'

export async function insertActivoAction(formData: unknown): Promise<Activo> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const validatedData = ActivoSchema.parse(formData)

  const { data, error } = await supabase
    .from('activos')
    .insert([{ ...toDatabaseAssetPayload(validatedData), user_id: user.id }])
    .select()
    .single()

  if (error) throw new Error(`Error añadiendo activo: ${error.message}`)
  return displayAssetType(data)
}

export async function updateActivoAction(id: string, formData: unknown): Promise<Activo> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const validatedData = ActivoSchema.partial().parse(formData)

  const { data, error } = await supabase
    .from('activos')
    .update(toDatabaseAssetPayload(validatedData))
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw new Error(`Error actualizando activo: ${error.message}`)
  return displayAssetType(data)
}

export async function getOrCreateCashAssetAction(): Promise<Activo> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { data: existing, error: searchError } = await supabase
    .from('activos')
    .select('*')
    .eq('user_id', user.id)
    .eq('ticker', 'CASH')
    .limit(1)
    .maybeSingle()

  if (searchError) throw new Error(`Error buscando Efectivo: ${searchError.message}`)
  if (existing) return existing

  const { data: newAsset, error: insertError } = await supabase
    .from('activos')
    .insert([{ user_id: user.id, ...CASH_ASSET_DEFAULTS }])
    .select()
    .single()

  if (insertError) throw new Error(`Error creando Efectivo: ${insertError.message}`)
  return newAsset
}

export async function saveDailySnapshotAction(totalValue: number, totalInvested: number): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  if (totalValue <= 0 && totalInvested <= 0) return

  const today = new Date().toISOString().split('T')[0]

  await supabase
    .from('portfolio_snapshots')
    .upsert({
      user_id: user.id,
      date: today,
      total_value: totalValue,
      total_invested: totalInvested,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id, date'
    })
}
