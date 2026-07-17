import { createClient } from '@/lib/supabase/client'
import type { Transaccion } from '@/lib/types'

export async function fetchTransacciones(limit = 20): Promise<Transaccion[]> {
  const { data, error } = await createClient()
    .from('transacciones')
    .select('*, activo:activos(ticker, nombre, tipo, moneda)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<Transaccion[], { merge: false }>()

  if (error) throw new Error(`Error cargando transacciones: ${error.message}`)

  return data
}

export async function fetchAssetTransactions(assetId: string): Promise<Transaccion[]> {
  const { data, error } = await createClient()
    .from('transacciones')
    .select('*')
    .eq('activo_id', assetId)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
    .overrideTypes<Transaccion[], { merge: false }>()

  if (error) throw new Error(`Error cargando las operaciones del activo: ${error.message}`)
  return data
}

export async function fetchPendingTransactions(): Promise<Transaccion[]> {
  const { data, error } = await createClient()
    .from('transacciones')
    .select('*, activo:activos(ticker, nombre, tipo, moneda)')
    .eq('estado', 'Pendiente')
    .order('created_at', { ascending: false })
    .overrideTypes<Transaccion[], { merge: false }>()

  if (error) throw new Error(`Error cargando transacciones pendientes: ${error.message}`)

  return data
}

export async function fetchTransactions(limitCount = 100): Promise<Transaccion[]> {
  const { data, error } = await createClient()
    .from('transacciones')
    .select('*, activo:activos(ticker, nombre, tipo, moneda)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limitCount)
    .overrideTypes<Transaccion[], { merge: false }>()

  if (error) throw new Error(`Error cargando transacciones: ${error.message}`)

  return data
}

export async function fetchAllTransactionsForTax(): Promise<Transaccion[]> {
  const { data, error } = await createClient()
    .from('transacciones')
    .select(`
      *,
      activo:activos(*)
    `)
    .order('fecha', { ascending: true })
    .overrideTypes<Transaccion[], { merge: false }>()

  if (error) throw new Error(`Error obteniendo transacciones fiscales: ${error.message}`)
  
  return data
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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { data, error } = await supabase
    .from('transacciones')
    .insert([{ ...tx, user_id: user.id }])
    .select()
    .single()
    .overrideTypes<Transaccion, { merge: false }>()

  if (error) throw new Error(`Error registrando transacción: ${error.message}`)
  return data
}

export async function updateTransaccion(id: string, updates: {
  tipo_operacion?: string
  cantidad?: number
  precio_unitario?: number
  comision?: number
  fecha?: string
  notas?: string
  estado?: string
}): Promise<Transaccion> {
  const { data, error } = await createClient()
    .from('transacciones')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
    .overrideTypes<Transaccion, { merge: false }>()

  if (error) throw new Error(`Error actualizando transacción: ${error.message}`)
  return data
}

export async function deleteTransaccion(id: string): Promise<void> {
  const { error } = await createClient()
    .from('transacciones')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Error eliminando transacción: ${error.message}`)
}
