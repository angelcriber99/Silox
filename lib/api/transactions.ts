import { getSupabaseClient } from '@/lib/supabase'
import type { Transaccion } from '@/lib/types'

export async function fetchTransacciones(limit = 20): Promise<Transaccion[]> {
  const { data, error } = await getSupabaseClient()
    .from('transacciones')
    .select('*, activo:activos(ticker, nombre, tipo)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Error cargando transacciones: ${error.message}`)

  return (data ?? []).map((row) => ({
    ...row,
    cantidad: Number(row.cantidad),
    precio_unitario: Number(row.precio_unitario),
    comision: Number(row.comision),
  }))
}

export async function fetchAllTransactionsForTax(): Promise<Transaccion[]> {
  const { data, error } = await getSupabaseClient()
    .from('transacciones')
    .select(`
      *,
      activo:activos(*)
    `)
    .order('fecha', { ascending: true })

  if (error) throw new Error(`Error obteniendo transacciones fiscales: ${error.message}`)
  
  return (data ?? []).map(t => ({
    ...t,
    cantidad: Number(t.cantidad),
    precio_unitario: Number(t.precio_unitario),
    comision: Number(t.comision),
  }))
}

export async function insertTransaccion(tx: {
  activo_id: string
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  comision?: number
  fecha: string
  notas?: string
}): Promise<Transaccion> {
  const { data, error } = await getSupabaseClient()
    .from('transacciones')
    .insert([tx])
    .select()
    .single()

  if (error) throw new Error(`Error registrando transacción: ${error.message}`)
  return {
    ...data,
    cantidad: Number(data.cantidad),
    precio_unitario: Number(data.precio_unitario),
    comision: Number(data.comision),
  }
}

export async function updateTransaccion(id: string, updates: {
  tipo_operacion?: string
  cantidad?: number
  precio_unitario?: number
  comision?: number
  fecha?: string
  notas?: string
}): Promise<Transaccion> {
  const { data, error } = await getSupabaseClient()
    .from('transacciones')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Error actualizando transacción: ${error.message}`)
  return {
    ...data,
    cantidad: Number(data.cantidad),
    precio_unitario: Number(data.precio_unitario),
    comision: Number(data.comision),
  }
}

export async function deleteTransaccion(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('transacciones')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Error eliminando transacción: ${error.message}`)
}
