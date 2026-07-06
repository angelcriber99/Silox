import { createClient } from '@/lib/supabase/client'
import type { Posicion, Activo, EnrichedPosition, PriceData, PortfolioTotals } from '@/lib/types'

export async function fetchPosiciones(): Promise<Posicion[]> {
  const supabase = createClient()
  const { data: posiciones, error: errorPos } = await supabase
    .from('posiciones')
    .select('*')

  if (errorPos) throw new Error(`Error cargando posiciones: ${errorPos.message}`)

  const { data: activos, error: errorAct } = await supabase
    .from('activos')
    .select('id, notas')

  if (errorAct) throw new Error(`Error cargando activos (notas): ${errorAct.message}`)

  const notasMap = new Map(activos.map(a => [a.id, a.notas]))

  return (posiciones ?? []).map(p => ({
    ...p,
    notas: notasMap.get(p.activo_id) ?? null
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
  moneda: string
  sector?: string
  geografia?: string
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
  sector?: string
  geografia?: string
  notas?: string | null
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

export async function getOrCreateCashAsset(): Promise<Activo> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  // Buscar si ya existe
  const { data: existing, error: searchError } = await supabase
    .from('activos')
    .select('*')
    .eq('user_id', user.id)
    .eq('tipo', 'Liquidez')
    .limit(1)
    .single()

  if (existing) return existing

  // Si no existe, lo creamos
  const { data: newAsset, error: insertError } = await supabase
    .from('activos')
    .insert([{
      user_id: user.id,
      ticker: 'CASH',
      nombre: 'Efectivo',
      tipo: 'Liquidez',
      estrategia: 'Liquidez',
      moneda: 'EUR'
    }])
    .select()
    .single()

  if (insertError) throw new Error(`Error creando Efectivo: ${insertError.message}`)
  return newAsset
}

export function enrichPositions(
  positions: Posicion[],
  priceDataPayload: { prices: Record<string, PriceData>, fxRates?: Record<string, number> }
): EnrichedPosition[] {
  const { prices, fxRates = {} } = priceDataPayload

  return positions.map((p) => {
    const priceData = prices[p.ticker]
    const precio_medio_real = p.unidades > 0 ? p.coste_total / p.unidades : 0

    const isCashAsset = p.ticker === 'CASH'
    const fxRate = p.moneda === 'EUR' ? 1 : (fxRates[p.moneda] || 1)
    
    const fallbackPriceNativo = (p.tipo === 'Fondo Monetario' || p.tipo === 'Liquidez' || isCashAsset) ? 1.00 : precio_medio_real
    const fallbackPriceEur = fallbackPriceNativo / fxRate

    const precio_actual = isCashAsset ? 1.00 : (priceData?.price ?? fallbackPriceEur)
    const precio_actual_nativo = isCashAsset ? 1.00 : (priceData?.originalPrice ?? fallbackPriceNativo)
    const original_currency = priceData?.originalCurrency ?? p.moneda
    const change_percent_24h = priceData?.changePercent24h ?? null
    let sparkline = priceData?.sparkline ?? []
    
    if (sparkline.length < 2 && precio_actual !== null) {
      sparkline = Array(7).fill(precio_actual)
    }
    
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
        
    let change_amount_24h = null
    if (valor_actual_eur !== null && change_percent_24h !== null) {
      const vAyer = valor_actual_eur / (1 + change_percent_24h / 100)
      change_amount_24h = valor_actual_eur - vAyer
    }

    const precio_medio = precio_medio_real

    return {
      ...p,
      precio_actual,
      precio_actual_nativo,
      original_currency,
      tipo: p.ticker.startsWith('CASH') || p.nombre?.toLowerCase().includes('efectivo') ? 'Liquidez' : p.tipo,
      valor_actual: valor_actual_eur,
      valor_actual_nativo,
      coste_total_eur,
      pnl,
      pnl_percent,
      precio_medio,
      sparkline,
      change_percent_24h,
      change_amount_24h,
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
  const totalCost = positions.reduce((sum, p) => sum + p.coste_total_eur, 0)
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

export async function savePortfolioHistory(totalValue: number, totalInvested: number): Promise<void> {
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  if (totalValue <= 0 && totalInvested <= 0) return

  // Throttle: Check if we saved a point in the last 15 minutes
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString()
  
  const { data: recent } = await supabase
    .from('portfolio_history')
    .select('id')
    .eq('user_id', user.id)
    .gte('timestamp', fifteenMinsAgo)
    .limit(1)

  if (recent && recent.length > 0) {
    // Already saved recently, skip
    return
  }

  await supabase
    .from('portfolio_history')
    .insert({
      user_id: user.id,
      total_value: totalValue,
      total_invested: totalInvested,
    })
}

export async function fetchHistory(): Promise<{ timestamp: string, total_value: number, total_invested: number }[]> {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('portfolio_history')
    .select('timestamp, total_value, total_invested')
    .order('timestamp', { ascending: true })

  if (error) {
    console.error("Error fetching history:", error)
    return []
  }

  return data ?? []
}
