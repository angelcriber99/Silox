import { createClient } from '@/lib/supabase/client'
import type { Posicion, Activo, EnrichedPosition, PriceData, PortfolioTotals } from '@/lib/types'

export async function fetchPosiciones(): Promise<Posicion[]> {
  const { data, error } = await createClient()
    .from('posiciones')
    .select('*')

  if (error) throw new Error(`Error cargando posiciones: ${error.message}`)

  return (data ?? []).map((row) => ({
    ...row,
    unidades: Number(row.unidades),
    coste_total: Number(row.coste_total),
    comisiones_total: Number(row.comisiones_total),
    num_operaciones: Number(row.num_operaciones),
  }))
}

export async function fetchActivos(): Promise<Activo[]> {
  const { data, error } = await createClient()
    .from('activos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Error cargando activos: ${error.message}`)
  return data ?? []
}

export async function insertActivo(activo: {
  ticker: string
  isin?: string
  nombre?: string
  tipo: string
  estrategia: string
  moneda?: string
}): Promise<Activo> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('No estás autenticado')

  const { data, error } = await supabase
    .from('activos')
    .insert([{ ...activo, user_id: user.id }])
    .select()
    .single()

  if (error) throw new Error(`Error añadiendo activo: ${error.message}`)
  return data
}

export async function updateActivo(id: string, updates: {
  ticker?: string
  isin?: string
  nombre?: string
  tipo?: string
  estrategia?: string
  moneda?: string
}): Promise<Activo> {
  const { data, error } = await createClient()
    .from('activos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Error actualizando activo: ${error.message}`)
  return data
}

export function enrichPositions(
  positions: Posicion[],
  priceDataPayload: { prices: Record<string, PriceData>, fxRates?: Record<string, number> }
): EnrichedPosition[] {
  const { prices, fxRates = {} } = priceDataPayload

  return positions.map((p) => {
    const priceData = prices[p.ticker]
    const precio_medio_real = p.unidades > 0 ? p.coste_total / p.unidades : 0

    const fallbackPrice = p.tipo === 'Fondo Monetario' ? 1.00 : precio_medio_real

    const precio_actual = priceData?.price ?? fallbackPrice
    const precio_actual_nativo = priceData?.originalPrice ?? fallbackPrice
    const original_currency = priceData?.originalCurrency ?? p.moneda
    const change_percent_24h = priceData?.changePercent24h ?? null
    let sparkline = priceData?.sparkline ?? []
    
    if (sparkline.length < 2 && precio_actual !== null) {
      sparkline = Array(7).fill(precio_actual)
    }
    
    const fxRate = p.moneda === 'EUR' ? 1 : (fxRates[p.moneda] || 1)
    
    const coste_total_eur = p.coste_total / fxRate
    
    const valor_actual_eur =
      precio_actual !== null && p.unidades > 0
        ? p.unidades * precio_actual
        : null

    const valor_actual_nativo = 
      precio_actual_nativo !== null && p.unidades > 0
        ? p.unidades * precio_actual_nativo
        : null

    const pnl =
      valor_actual_eur !== null && coste_total_eur > 0
        ? valor_actual_eur - coste_total_eur
        : null
        
    const pnl_percent =
      pnl !== null && coste_total_eur > 0
        ? (pnl / coste_total_eur) * 100
        : null
        
    const precio_medio = precio_medio_real

    return {
      ...p,
      precio_actual,
      precio_actual_nativo,
      original_currency,
      valor_actual: valor_actual_eur,
      valor_actual_nativo,
      coste_total_eur,
      pnl,
      pnl_percent,
      precio_medio,
      sparkline,
      change_percent_24h,
    }
  })
}

export function computePortfolioTotals(
  positions: EnrichedPosition[]
): PortfolioTotals {
  const withValues = positions.filter((p) => p.valor_actual !== null)
  const totalValue = withValues.reduce(
    (sum, p) => sum + (p.valor_actual ?? 0),
    0
  )
  const totalCost = withValues.reduce((sum, p) => sum + p.coste_total_eur, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  let totalPnl24h = 0
  let totalValorAyer = 0
  
  withValues.forEach((p) => {
    const cp = p.change_percent_24h ?? 0
    const v = p.valor_actual ?? 0
    if (v > 0) {
      const vAyer = v / (1 + cp / 100)
      totalPnl24h += (v - vAyer)
      totalValorAyer += vAyer
    }
  })
  
  const totalPnlPercent24h = totalValorAyer > 0 ? (totalPnl24h / totalValorAyer) * 100 : 0

  return {
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPercent,
    totalPnl24h,
    totalPnlPercent24h,
    positionCount: positions.length,
    hasAllPrices: withValues.length === positions.filter((p) => p.unidades > 0).length,
  }
}
