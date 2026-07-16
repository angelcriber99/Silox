import { createClient } from '@/lib/supabase/client'
import type { EventoRecurrente, PriceData } from '@/lib/types'
import { fetchMarketPrices } from '@/lib/actions/market'

export async function fetchEventosRecurrentes(): Promise<EventoRecurrente[]> {
  const { data, error } = await createClient()
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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { data: result, error } = await supabase
    .from('eventos_recurrentes')
    .insert([{ ...data, user_id: user.id }])
    .select('*, activo:activos(ticker, nombre, tipo)')
    .single()

  if (error) throw new Error(`Error insertando evento recurrente: ${error.message}`)
  return result as EventoRecurrente
}

export async function updateEventoRecurrente(
  id: string,
  data: Omit<EventoRecurrente, 'id' | 'created_at' | 'activo' | 'activo_id'> & { activo_id?: string }
): Promise<EventoRecurrente> {
  const { data: result, error } = await createClient()
    .from('eventos_recurrentes')
    .update(data)
    .eq('id', id)
    .select('*, activo:activos(ticker, nombre, tipo)')
    .single()

  if (error) throw new Error(`Error actualizando evento recurrente: ${error.message}`)
  return result as EventoRecurrente
}

export async function deleteEventoRecurrente(id: string): Promise<void> {
  const { error } = await createClient()
    .from('eventos_recurrentes')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Error eliminando evento recurrente: ${error.message}`)
}

export async function fetchPrices(
  tickers: string[]
): Promise<{ prices: Record<string, PriceData>, fxRates?: Record<string, number>, marketState?: string }> {
  if (tickers.length === 0) return { prices: {} }

  try {
    const data = await fetchMarketPrices(tickers, true)
    
    const prices: Record<string, PriceData> = {}
    for (const [ticker, valRaw] of Object.entries(data.prices)) {
      const val = valRaw
      prices[ticker] = {
        price: val.price ?? null,
        sparkline: val.sparkline ?? [],
        originalPrice: val.originalPrice ?? null,
        originalCurrency: val.originalCurrency,
        changePercent24h: val.changePercent24h ?? null,
        dailyChangePercent24h: val.dailyChangePercent24h ?? null,
        marketState: val.marketState,
        latestTime: val.latestTime,
        exchangeTimezone: val.exchangeTimezone,
        sessionStart: val.sessionStart,
        sessionEnd: val.sessionEnd,
        nextTransition: val.nextTransition,
        isStale: val.isStale ?? true,
      }
    }
    return { prices, fxRates: data.fxRates, marketState: data.marketState }
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Error obteniendo precios')
  }
}
