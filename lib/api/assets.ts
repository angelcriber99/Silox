import { createClient } from '@/lib/supabase/client'
import type { Posicion, Activo, EnrichedPosition, PriceData, PortfolioTotals } from '@/lib/types'
import { CASH_ASSET_DEFAULTS, displayAssetType, isInvestablePortfolioAsset, toDatabaseAssetPayload } from '@/lib/domain/assets/normalization'
import {
  applyPortfolioAccounting,
  calculatePortfolioAccounting,
  type PortfolioAccountingTransaction,
} from '@/lib/domain/portfolio/accounting-engine'
import {
  calculateFixedNetInvestmentEur,
  historicalFxKey,
} from '@/lib/domain/portfolio/contributions'
import { fetchHistoricalFxRates } from '@/lib/actions/historical-fx'
import { collectAllPages } from '@/lib/utils/pagination'

export async function fetchPosiciones(): Promise<Posicion[]> {
  const supabase = createClient()
  const { data: posiciones, error: errorPos } = await supabase
    .from('posiciones')
    .select('*')

  if (errorPos) throw new Error(`Error cargando posiciones: ${errorPos.message}`)

  const normalizedPositions = (posiciones ?? []).map(displayAssetType)
  const assetIds = normalizedPositions.map((position) => position.activo_id)

  if (assetIds.length === 0) return normalizedPositions

  let completedTransactions
  try {
    completedTransactions = await collectAllPages((from, to) => supabase
      .from('transacciones')
      .select('id, activo_id, tipo_operacion, cantidad, precio_unitario, comision, retencion_origen, retencion_destino, fecha, created_at, notas, tipo_cambio_eur')
      .in('activo_id', assetIds)
      .eq('estado', 'Completada')
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to))
  } catch (error) {
    throw new Error(`Error calculando el coste FIFO de las posiciones: ${error instanceof Error ? error.message : 'error desconocido'}`)
  }

  const accounting = calculatePortfolioAccounting(
    completedTransactions as PortfolioAccountingTransaction[],
  )
  return applyPortfolioAccounting(normalizedPositions, accounting).positions
}

export async function fetchActivos(): Promise<Activo[]> {
  const { data, error } = await createClient()
    .from('activos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Error cargando activos: ${error.message}`)
  return (data ?? []).map(displayAssetType).filter(isInvestablePortfolioAsset)
}

export async function fetchPortfolioFunding(): Promise<number | null> {
  const supabase = createClient()
  let data
  try {
    data = await collectAllPages((from, to) => supabase
      .from('transacciones')
      .select('id, activo_id, tipo_operacion, cantidad, precio_unitario, comision, retencion_origen, retencion_destino, fecha, created_at, notas, tipo_cambio_eur, activo:activos(ticker, tipo, moneda)')
      .eq('estado', 'Completada')
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to))
  } catch (error) {
    throw new Error(`Error calculando el capital neto aportado: ${error instanceof Error ? error.message : 'error desconocido'}`)
  }

  const accounting = calculatePortfolioAccounting(
    data as PortfolioAccountingTransaction[],
  )
  const funding = accounting.funding
  const missingFlows = funding.datedFlows.filter((flow) =>
    flow.currency !== 'EUR' && flow.fixedRate === null && Boolean(flow.date)
  )
  const historicalRates = await fetchHistoricalFxRates(missingFlows.map((flow) => ({
    currency: flow.currency,
    date: flow.date,
  })))

  if (missingFlows.length > 0) {
    const idsByRate = new Map<number, string[]>()
    for (const flow of missingFlows) {
      if (!flow.transactionId) continue
      const rate = historicalRates[historicalFxKey(flow.currency, flow.date)]
      if (!rate) continue
      const ids = idsByRate.get(rate) ?? []
      ids.push(flow.transactionId)
      idsByRate.set(rate, ids)
    }
    await Promise.all(Array.from(idsByRate, ([rate, ids]) =>
      supabase
        .from('transacciones')
        .update({ tipo_cambio_eur: rate })
        .in('id', ids)
        .is('tipo_cambio_eur', null)
    ))
  }

  return calculateFixedNetInvestmentEur(funding, historicalRates)
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
    .insert([{ ...toDatabaseAssetPayload(activo), user_id: user.id }])
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
    .update(toDatabaseAssetPayload(updates))
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
    .eq('ticker', 'CASH')
    .limit(1)
    .maybeSingle()

  if (searchError) throw new Error(`Error buscando Efectivo: ${searchError.message}`)

  if (existing) return existing

  // Si no existe, lo creamos
  const { data: newAsset, error: insertError } = await supabase
    .from('activos')
    .insert([{ user_id: user.id, ...CASH_ASSET_DEFAULTS }])
    .select()
    .single()

  if (insertError) throw new Error(`Error creando Efectivo: ${insertError.message}`)
  return newAsset
}

export function enrichPositions(
  positions: Posicion[],
  priceDataPayload: { prices: Record<string, PriceData>, fxRates?: Record<string, number>, fxPreviousRates?: Record<string, number> }
): EnrichedPosition[] {
  const { prices, fxRates = {}, fxPreviousRates = {} } = priceDataPayload

  return positions.map((pos) => {
    const p = { ...pos }
    
    // Si la liquidez entra en negativo (porque se ha comprado sin registrar un ingreso previo),
    // la ignoramos forzando a 0 para que no reste del total del portfolio.
    if ((p.tipo === 'Liquidez' || p.ticker.startsWith('CASH')) && p.unidades < 0) {
      p.unidades = 0
      p.coste_total = 0
    }

    const priceData = prices[p.ticker]
    const precio_medio_real = p.unidades > 0 ? p.coste_total / p.unidades : 0

    const isCashAsset = p.ticker.startsWith('CASH')
    const fxRate = p.moneda === 'EUR' ? 1 : (fxRates[p.moneda] || 1)
    const previousFxRate = p.moneda === 'EUR' ? 1 : (fxPreviousRates[p.moneda] || fxRate)
    
    // NUNCA hacer fallback al precio de compra para acciones/ETFs si falla la API, 
    // porque distorsiona completamente el valor del portfolio.
    const fallbackPriceNativo = (p.tipo === 'Fondo Monetario' || p.tipo === 'Liquidez' || isCashAsset) ? 1.00 : null
    const fallbackPriceEur = fallbackPriceNativo !== null ? fallbackPriceNativo / fxRate : null

    const precio_actual = isCashAsset ? 1.00 / fxRate : (priceData?.price ?? fallbackPriceEur)
    const precio_actual_nativo = isCashAsset ? 1.00 : (priceData?.originalPrice ?? fallbackPriceNativo)
    const original_currency = priceData?.originalCurrency ?? p.moneda
    const precio_actual_usd = priceData?.priceUsd
      ?? (original_currency === 'USD' ? precio_actual_nativo : null)
      ?? (precio_actual !== null && fxRates.USD ? precio_actual * fxRates.USD : null)
    const change_percent_24h = priceData?.changePercent24h ?? null
    const daily_change_percent_24h = priceData?.dailyChangePercent24h ?? null
    let sparkline = priceData?.sparkline ?? []
    
    if (sparkline.length < 2 && precio_actual !== null) {
      sparkline = Array(7).fill(precio_actual)
    }
    
    const coste_total_eur = p.coste_total_eur_historico ?? (p.coste_total / fxRate)
    const dinero_invertido_eur = p.dinero_invertido_eur_historico ?? ((p.dinero_invertido ?? p.coste_total) / fxRate)
    
    const valor_actual_eur =
      p.unidades === 0 ? 0 :
      precio_actual !== null && p.unidades > 0
        ? p.unidades * precio_actual
        : null

    const valor_actual_nativo = 
      p.unidades === 0 ? 0 :
      precio_actual_nativo !== null && p.unidades > 0
        ? p.unidades * precio_actual_nativo
        : null

    const pnl =
      valor_actual_eur !== null
        ? valor_actual_eur - coste_total_eur
        : null
        
    const pnl_percent =
      pnl !== null && coste_total_eur !== 0
        ? (pnl / Math.abs(coste_total_eur)) * 100
        : null
        
    let change_amount_24h = null
    let change_amount_24h_nativo = null
    let daily_performance_base_eur = null
    if (precio_actual !== null && precio_actual_nativo !== null && daily_change_percent_24h !== null) {
      const dailyFactor = 1 + daily_change_percent_24h / 100
      if (Number.isFinite(dailyFactor) && dailyFactor > 0) {
        const currentUnits = Math.max(0, p.unidades)
        const previousUnits = p.has_daily_activity
          ? Math.max(0, currentUnits - (p.daily_net_units ?? 0))
          : currentUnits
        const previousPriceNative = precio_actual_nativo / dailyFactor
        const previousPriceEur = previousPriceNative / previousFxRate
        const netFlowNative = p.has_daily_activity ? (p.daily_net_flow_nativo ?? 0) : 0
        const netFlowEur = p.has_daily_activity
          ? (p.daily_net_flow_eur ?? (netFlowNative / fxRate))
          : 0
        const currentValueEur = currentUnits * precio_actual
        const currentValueNative = currentUnits * precio_actual_nativo
        const previousValueEur = previousUnits * previousPriceEur
        const previousValueNative = previousUnits * previousPriceNative

        change_amount_24h = currentValueEur - previousValueEur - netFlowEur
        change_amount_24h_nativo = currentValueNative - previousValueNative - netFlowNative
        daily_performance_base_eur = previousValueEur + Math.max(0, netFlowEur)
      }
    }

    const precio_medio = precio_medio_real

    return {
      ...p,
      precio_actual,
      precio_actual_nativo,
      precio_actual_usd,
      original_currency,
      tipo: p.ticker.startsWith('CASH') || p.nombre?.toLowerCase().includes('efectivo') ? 'Liquidez' : p.tipo,
      valor_actual: valor_actual_eur,
      valor_actual_nativo,
      coste_total_eur,
      dinero_invertido_eur,
      pnl,
      pnl_percent,
      precio_medio,
      sparkline,
      change_percent_24h,
      daily_change_percent_24h,
      change_amount_24h,
      change_amount_24h_nativo,
      daily_performance_base_eur,
      market_state: priceData?.marketState,
      price_updated_at: priceData?.latestTime,
      price_is_stale: priceData?.isStale ?? true,
      market_session_ends_at: priceData?.sessionEnd,
      market_timezone: priceData?.exchangeTimezone,
      price_kind: priceData?.priceKind,
      price_source: priceData?.priceSource,
    }
  })
}

export function computePortfolioTotals(
  positions: EnrichedPosition[],
  netContributions?: number | null,
): PortfolioTotals {
  const withValues = positions.filter((p) => p.valor_actual !== null)
  
  // Para el total, sumamos el valor real de los cotizados y el coste de los no cotizados/fallidos
  // para evitar que el portfolio caiga a 0 por errores de API.
  const totalValue = positions.reduce(
    (sum, p) => sum + (p.valor_actual !== null ? p.valor_actual : p.coste_total_eur),
    0
  )
  
  const openPositionCost = positions.reduce((sum, p) => sum + p.coste_total_eur, 0)
  const totalCost = netContributions ?? openPositionCost
  const totalPnl = totalValue - totalCost
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  let totalPnl24h = 0
  let totalSessionPnl = 0
  let totalSessionBaseline = 0
  let totalDailyBaseline = 0
  let dailyPerformancePositionCount = 0
  
  withValues.forEach((p) => {
    const v = p.valor_actual ?? 0
    if (p.change_amount_24h !== null) {
      totalPnl24h += p.change_amount_24h
      const dailyBase = p.daily_performance_base_eur ?? 0
      if (Number.isFinite(dailyBase) && dailyBase > 0) totalDailyBaseline += dailyBase
      if (p.unidades > 0 && dailyBase > 0) dailyPerformancePositionCount += 1
    }

    if (v > 0) {
      const sessionPercent = p.change_percent_24h
      const sessionFactor = sessionPercent === null ? 0 : 1 + sessionPercent / 100
      if (Number.isFinite(sessionFactor) && sessionFactor > 0) {
        const sessionBaseline = v / sessionFactor
        totalSessionPnl += v - sessionBaseline
        totalSessionBaseline += sessionBaseline
      }
    }
  })
  
  const totalPnlPercent24h = totalSessionBaseline > 0
    ? (totalSessionPnl / totalSessionBaseline) * 100
    : 0
  const totalDailyPnlPercent = totalDailyBaseline > 0
    ? (totalPnl24h / totalDailyBaseline) * 100
    : 0

  return {
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPercent,
    totalPnl24h,
    totalPnlPercent24h,
    totalSessionPnl,
    totalDailyPnlPercent,
    dailyPerformancePositionCount,
    positionCount: positions.filter((p) => p.unidades > 0 && p.tipo !== 'Liquidez').length,
    hasAllPrices: positions.filter((p) => p.unidades > 0).every((p) => p.valor_actual !== null),
    estimatedPositionCount: positions.filter((p) => p.unidades > 0 && p.tipo !== 'Liquidez' && (p.valor_actual === null || p.price_is_stale)).length,
    accountingIssueCount: positions.filter((p) => p.accounting_unit_mismatch).length,
  }
}

let portfolioHistoryWriteInFlight: Promise<void> | null = null

async function persistPortfolioHistory(totalValue: number, totalInvested: number): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  if (totalValue <= 0 && totalInvested <= 0) return

  // Throttle: Check if we saved a point in the last 15 minutes
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString()
  
  const { data: recent, error: recentError } = await supabase
    .from('portfolio_history')
    .select('id')
    .eq('user_id', user.id)
    .gte('timestamp', fifteenMinsAgo)
    .limit(1)

  if (recentError) throw new Error(`Error comprobando el histórico: ${recentError.message}`)

  if (recent && recent.length > 0) {
    // Already saved recently, skip
    return
  }

  const { error: insertError } = await supabase
    .from('portfolio_history')
    .insert({
      user_id: user.id,
      total_value: totalValue,
      total_invested: totalInvested,
    })

  if (insertError) throw new Error(`Error guardando el histórico: ${insertError.message}`)
}

export function savePortfolioHistory(totalValue: number, totalInvested: number): Promise<void> {
  if (portfolioHistoryWriteInFlight) return portfolioHistoryWriteInFlight

  const request = persistPortfolioHistory(totalValue, totalInvested)
  portfolioHistoryWriteInFlight = request
  return request.finally(() => {
    if (portfolioHistoryWriteInFlight === request) portfolioHistoryWriteInFlight = null
  })
}

export async function fetchHistory(): Promise<{ timestamp: string, total_value: number, total_invested: number }[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  try {
    return await collectAllPages((from, to) => supabase
      .from('portfolio_history')
      .select('timestamp, total_value, total_invested')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: true })
      .range(from, to))
  } catch (error) {
    console.error("Error fetching history:", error)
    return []
  }
}
