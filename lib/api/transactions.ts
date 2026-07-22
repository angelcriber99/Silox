import { createClient } from '@/lib/supabase/client'
import type { Transaccion } from '@/lib/types'
import { fetchHistoricalFxRates } from '@/lib/actions/historical-fx'
import { historicalFxKey } from '@/lib/domain/portfolio/contributions'

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
    .select('*, activo:activos(*)')
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
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transacciones')
    .select(`
      *,
      activo:activos(*)
    `)
    .eq('estado', 'Completada')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
    .overrideTypes<Transaccion[], { merge: false }>()

  if (error) throw new Error(`Error obteniendo transacciones fiscales: ${error.message}`)

  const requests = data
    .filter((transaction) => {
      const currency = transaction.activo?.moneda?.toUpperCase()
      return currency && currency !== 'EUR'
        && (!Number.isFinite(Number(transaction.tipo_cambio_eur)) || Number(transaction.tipo_cambio_eur) <= 0)
    })
    .map((transaction) => ({
      currency: transaction.activo!.moneda,
      date: transaction.fecha.slice(0, 10),
    }))
  const historicalRates = await fetchHistoricalFxRates(requests)
  const updatesByRate = new Map<number, string[]>()

  const hydrated = data.map((transaction) => {
    const currency = transaction.activo?.moneda?.toUpperCase()
    if (!currency) {
      throw new Error(`La operación ${transaction.id} no tiene una moneda asociada`)
    }

    const storedRate = Number(transaction.tipo_cambio_eur)
    const rate = Number.isFinite(storedRate) && storedRate > 0
      ? storedRate
      : currency === 'EUR'
        ? 1
        : historicalRates[historicalFxKey(currency, transaction.fecha)]

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`No se pudo obtener el cambio histórico ${currency}/EUR del ${transaction.fecha.slice(0, 10)}`)
    }

    if (transaction.tipo_cambio_eur === null || transaction.tipo_cambio_eur === undefined) {
      const ids = updatesByRate.get(rate) ?? []
      ids.push(transaction.id)
      updatesByRate.set(rate, ids)
    }

    return { ...transaction, tipo_cambio_eur: rate }
  })

  if (updatesByRate.size > 0) {
    const results = await Promise.all(Array.from(updatesByRate, ([rate, ids]) =>
      supabase
        .from('transacciones')
        .update({ tipo_cambio_eur: rate })
        .in('id', ids)
        .is('tipo_cambio_eur', null)
    ))
    const persistenceError = results.find((result) => result.error)?.error
    if (persistenceError) {
      throw new Error(`No se pudieron fijar los cambios históricos: ${persistenceError.message}`)
    }
  }

  return hydrated
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
