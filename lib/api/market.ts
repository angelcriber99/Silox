import { getSupabaseClient } from '@/lib/supabase'
import type { EventoRecurrente, PriceData } from '@/lib/types'

export async function fetchEventosRecurrentes(): Promise<EventoRecurrente[]> {
  const { data, error } = await getSupabaseClient()
    .from('eventos_recurrentes')
    .select('*, activo:activos(ticker, nombre, tipo)')
    .order('dia_del_mes', { ascending: true })

  if (error) {
    if (error.code === '42P01') return [] // Relation does not exist
    throw new Error(`Error cargando eventos: ${error.message}`)
  }
  return data ?? []
}

export async function insertEventoRecurrente(
  data: Omit<EventoRecurrente, 'id' | 'created_at' | 'activo'>
): Promise<EventoRecurrente> {
  const { data: result, error } = await getSupabaseClient()
    .from('eventos_recurrentes')
    .insert(data)
    .select('*, activo:activos(ticker, nombre, tipo)')
    .single()

  if (error) throw new Error(`Error insertando evento recurrente: ${error.message}`)
  return result as EventoRecurrente
}

export async function updateEventoRecurrente(
  id: string,
  data: Omit<EventoRecurrente, 'id' | 'created_at' | 'activo' | 'activo_id'> & { activo_id?: string }
): Promise<EventoRecurrente> {
  const { data: result, error } = await getSupabaseClient()
    .from('eventos_recurrentes')
    .update(data)
    .eq('id', id)
    .select('*, activo:activos(ticker, nombre, tipo)')
    .single()

  if (error) throw new Error(`Error actualizando evento recurrente: ${error.message}`)
  return result as EventoRecurrente
}

export async function deleteEventoRecurrente(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('eventos_recurrentes')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Error eliminando evento recurrente: ${error.message}`)
}

export async function fetchPrices(
  tickers: string[]
): Promise<{ prices: Record<string, PriceData>, fxRates?: Record<string, number> }> {
  if (tickers.length === 0) return { prices: {} }

  const res = await fetch('/api/precios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers, convertToEur: true }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error obteniendo precios')

  const prices: Record<string, PriceData> = {}
  for (const [ticker, val] of Object.entries(data.prices)) {
    const v = val as PriceData
    prices[ticker] = {
      price: v.price ?? null,
      sparkline: v.sparkline ?? [],
      originalPrice: v.originalPrice ?? null,
      originalCurrency: v.originalCurrency,
    }
  }
  return { prices, fxRates: data.fxRates }
}
