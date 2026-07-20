import 'server-only'

import { z } from 'zod'
import type { MobileAuthContext } from './auth'
import { MobileApiError } from './api'
import {
  AlertInputSchema,
  AlertPatchSchema,
  AssetInputSchema,
  DecimalInputSchema,
  EventInputSchema,
  IdSchema,
  SettingsInputSchema,
  TransactionInputSchema,
  TransactionPatchSchema,
  type TransactionListQuery,
  TransferInputSchema,
} from './schemas'
import { displayAssetType, isInvestablePortfolioAsset, toDatabaseAssetPayload } from '@/lib/domain/assets/normalization'
import { enrichPositions, computePortfolioTotals } from '@/lib/api/assets'
import { calculateFixedNetInvestmentEur, calculateNetInvestmentByCurrency, historicalFxKey } from '@/lib/domain/portfolio/contributions'
import { fetchHistoricalFxRates } from '@/lib/actions/historical-fx'
import { fetchMarketPricesDirect } from '@/lib/actions/market'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import { mapSettledWithConcurrency } from '@/lib/utils/async'
import { calculateDailyPositionActivity } from '@/lib/utils/daily-position-performance'
import { calculateOpenPositionBases, calculateOpenPurchaseLots } from '@/lib/utils/open-cost-basis'
import type { Database } from '@/lib/database.types'

type Context = MobileAuthContext

function databaseFailure(operation: string, error: { message: string } | null) {
  if (error) throw new MobileApiError(500, 'database_error', `No se pudo ${operation}`)
}

function decimal(value: number | null | undefined): string | null {
  return value == null ? null : String(value)
}

function assetDto(row: Record<string, unknown>) {
  const asset = displayAssetType(row as unknown as Database['public']['Tables']['activos']['Row'])
  return {
    id: asset.id,
    ticker: asset.ticker,
    isin: asset.isin,
    name: asset.nombre,
    type: asset.tipo,
    strategy: asset.estrategia,
    currency: asset.moneda,
    sector: asset.sector,
    geography: asset.geografia,
    notes: asset.notas,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
  }
}

function transactionDto(row: Record<string, unknown>) {
  const asset = row.activo as Record<string, unknown> | null | undefined
  return {
    id: row.id,
    assetId: row.activo_id,
    operation: row.tipo_operacion,
    quantity: decimal(row.cantidad as number),
    unitPrice: decimal(row.precio_unitario as number),
    commission: decimal(row.comision as number),
    sourceWithholding: decimal(row.retencion_origen as number | null),
    destinationWithholding: decimal(row.retencion_destino as number | null),
    status: row.estado,
    date: row.fecha,
    notes: row.notas,
    createdAt: row.created_at,
    linkedTransactionId: row.linked_transaction_id,
    asset: asset ? {
      ticker: asset.ticker,
      name: asset.nombre,
      type: asset.tipo,
      currency: asset.moneda,
    } : undefined,
  }
}

function alertDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    ticker: row.ticker,
    targetPrice: decimal(row.target_price as number),
    condition: row.condition,
    triggered: row.triggered,
    createdAt: row.created_at,
  }
}

function eventDto(row: Record<string, unknown>) {
  const asset = row.activo as Record<string, unknown> | null | undefined
  return {
    id: row.id,
    assetId: row.activo_id,
    title: row.titulo,
    dayOfMonth: row.dia_del_mes,
    type: row.tipo,
    createdAt: row.created_at,
    asset: asset ? { ticker: asset.ticker, name: asset.nombre, type: asset.tipo } : undefined,
  }
}

export function me(context: Context) {
  return {
    id: context.user.id,
    email: context.user.email ?? null,
    displayName: context.user.user_metadata?.full_name ?? context.user.user_metadata?.name ?? null,
    authMethod: context.method,
    createdAt: context.user.created_at,
  }
}

export async function listAssets(context: Context) {
  const { data, error } = await context.supabase
    .from('activos')
    .select('*')
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: false })
  databaseFailure('cargar los activos', error)
  return (data ?? [])
    .filter(isInvestablePortfolioAsset)
    .map((row) => assetDto(row as unknown as Record<string, unknown>))
}

export async function getAsset(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from('activos')
    .select('*')
    .eq('id', id)
    .eq('user_id', context.user.id)
    .maybeSingle()
  databaseFailure('cargar el activo', error)
  if (!data) throw new MobileApiError(404, 'asset_not_found', 'Activo no encontrado')
  return assetDto(data as unknown as Record<string, unknown>)
}

export async function createAsset(context: Context, input: unknown) {
  const parsed = AssetInputSchema.parse(input)
  const payload = toDatabaseAssetPayload({
    ticker: parsed.ticker,
    isin: parsed.isin ?? undefined,
    nombre: parsed.name ?? undefined,
    tipo: parsed.type,
    estrategia: parsed.strategy,
    moneda: parsed.currency,
    sector: parsed.sector,
    geografia: parsed.geography,
    notas: parsed.notes ?? undefined,
  })
  const { data, error } = await context.supabase
    .from('activos')
    .insert({ ...payload, user_id: context.user.id })
    .select()
    .single()
  databaseFailure('crear el activo', error)
  return assetDto(data as unknown as Record<string, unknown>)
}

export async function updateAsset(context: Context, id: string, input: unknown) {
  await getAsset(context, id)
  const parsed = AssetInputSchema.partial().parse(input)
  const payload = toDatabaseAssetPayload({
    ...(parsed.ticker === undefined ? {} : { ticker: parsed.ticker }),
    ...(parsed.isin === undefined ? {} : { isin: parsed.isin ?? undefined }),
    ...(parsed.name === undefined ? {} : { nombre: parsed.name ?? undefined }),
    ...(parsed.type === undefined ? {} : { tipo: parsed.type }),
    ...(parsed.strategy === undefined ? {} : { estrategia: parsed.strategy }),
    ...(parsed.currency === undefined ? {} : { moneda: parsed.currency }),
    ...(parsed.sector === undefined ? {} : { sector: parsed.sector }),
    ...(parsed.geography === undefined ? {} : { geografia: parsed.geography }),
    ...(parsed.notes === undefined ? {} : { notas: parsed.notes }),
  })
  const { data, error } = await context.supabase
    .from('activos')
    .update(payload)
    .eq('id', id)
    .eq('user_id', context.user.id)
    .select()
    .single()
  databaseFailure('actualizar el activo', error)
  return assetDto(data as unknown as Record<string, unknown>)
}

export async function deleteAsset(context: Context, id: string) {
  await getAsset(context, id)
  const { error } = await context.supabase
    .from('activos')
    .delete()
    .eq('id', id)
    .eq('user_id', context.user.id)
  databaseFailure('eliminar el activo', error)
}

export async function portfolio(context: Context) {
  const { data: rawPositions, error } = await context.supabase
    .from('posiciones')
    .select('*')
    .eq('user_id', context.user.id)
  databaseFailure('cargar la cartera', error)

  const { data: fundingTransactions, error: fundingError } = await context.supabase
    .from('transacciones')
    .select('id, activo_id, tipo_operacion, cantidad, precio_unitario, comision, retencion_origen, retencion_destino, fecha, created_at, notas, tipo_cambio_eur, activo:activos(ticker, tipo, moneda)')
    .eq('user_id', context.user.id)
    .eq('estado', 'Completada')
  databaseFailure('calcular el capital neto aportado', fundingError)
  const openBases = calculateOpenPositionBases(fundingTransactions ?? [])
  const dailyActivity = calculateDailyPositionActivity(fundingTransactions ?? [])

  // Keep the native dashboard on the exact same accounting universe as web.
  // Cash and money-market bookkeeping never belongs to the visible portfolio.
  const positions = (rawPositions ?? [])
    .filter(isInvestablePortfolioAsset)
    .map((position) => {
      const openBasis = openBases.get(position.activo_id)
      const activity = dailyActivity.get(position.activo_id)
      return {
        ...position,
        ...(openBasis !== undefined ? {
          coste_total: openBasis.performanceCost,
          dinero_invertido: openBasis.investedCost,
        } : {}),
        has_daily_activity: Boolean(activity),
        daily_net_units: activity?.netUnits ?? 0,
        daily_net_flow_nativo: activity?.netFlowNative ?? 0,
      }
    })
  const tickers = positions
    .filter((position) => position.unidades > 0 || position.has_daily_activity)
    .map((position) => position.ticker)
  const market = tickers.length > 0
    ? await fetchMarketPricesDirect(tickers, true)
    : { prices: {}, fxRates: { EUR: 1 }, displayCurrency: 'EUR', marketState: 'CLOSED' }
  const enriched = enrichPositions(positions, market)
  const funding = calculateNetInvestmentByCurrency(fundingTransactions ?? [])
  const missingFx = funding.datedFlows.filter((flow) => flow.currency !== 'EUR' && flow.fixedRate === null)
  const historicalRates = await fetchHistoricalFxRates(missingFx.map((flow) => ({
    currency: flow.currency,
    date: flow.date,
  })))
  const idsByRate = new Map<number, string[]>()
  for (const flow of missingFx) {
    if (!flow.transactionId) continue
    const rate = historicalRates[historicalFxKey(flow.currency, flow.date)]
    if (!rate) continue
    const ids = idsByRate.get(rate) ?? []
    ids.push(flow.transactionId)
    idsByRate.set(rate, ids)
  }
  await Promise.all(Array.from(idsByRate, ([rate, ids]) =>
    context.supabase
      .from('transacciones')
      .update({ tipo_cambio_eur: rate })
      .in('id', ids)
      .eq('user_id', context.user.id)
      .is('tipo_cambio_eur', null)
  ))
  const netContributions = calculateFixedNetInvestmentEur(funding, historicalRates)
  const totals = computePortfolioTotals(enriched, netContributions)

  return {
    asOf: new Date().toISOString(),
    displayCurrency: 'EUR',
    marketState: market.marketState,
    totals: {
      value: decimal(totals.totalValue),
      cost: decimal(totals.totalCost),
      profitLoss: decimal(totals.totalPnl),
      profitLossPercent: totals.totalPnlPercent,
      dailyProfitLoss: decimal(totals.totalPnl24h),
      dailyProfitLossPercent: totals.totalDailyPnlPercent,
      sessionProfitLoss: decimal(totals.totalSessionPnl),
      sessionProfitLossPercent: totals.totalPnlPercent24h,
      positionCount: totals.positionCount,
      hasAllPrices: totals.hasAllPrices,
    },
    positions: enriched.filter((position) => position.tipo !== 'Liquidez').map((position) => {
      const currentPriceInAssetCurrency = position.moneda === 'EUR'
        ? position.precio_actual
        : position.original_currency === position.moneda
          ? position.precio_actual_nativo
          : position.precio_actual_nativo ?? position.precio_actual
      const assetTransactions = (fundingTransactions ?? []).filter(
        (transaction) => transaction.activo_id === position.activo_id,
      )
      const openPurchaseLots = calculateOpenPurchaseLots(assetTransactions)
        .slice()
        .reverse()
        .map((lot) => ({
          transactionId: lot.transactionId ?? `${lot.date}:${lot.createdAt}:${lot.originalQuantity}`,
          date: lot.date,
          operation: lot.operation,
          originalQuantity: decimal(lot.originalQuantity),
          remainingQuantity: decimal(lot.remainingQuantity),
          purchasePrice: decimal(lot.purchasePrice),
          commission: decimal(lot.commission),
          performanceUnitCost: decimal(lot.performanceUnitCost),
          investedUnitCost: decimal(lot.investedUnitCost),
        }))

      return {
        assetId: position.activo_id,
        ticker: position.ticker,
        name: position.nombre,
        isin: position.isin,
        type: position.tipo,
        strategy: position.estrategia,
        currency: position.moneda,
        units: decimal(position.unidades),
        totalCost: decimal(position.coste_total_eur),
        investedCash: decimal(position.dinero_invertido_eur),
        currentPrice: decimal(currentPriceInAssetCurrency),
        currentValue: decimal(position.valor_actual),
        profitLoss: decimal(position.pnl),
        profitLossPercent: position.pnl_percent,
        dailyChange: decimal(position.change_amount_24h),
        dailyChangePercent: position.daily_change_percent_24h,
        sessionChangePercent: position.change_percent_24h,
        openPurchaseLots,
        sparkline: position.sparkline,
        marketState: position.market_state ?? null,
        priceUpdatedAt: position.price_updated_at ?? null,
        isPriceStale: position.price_is_stale ?? true,
      }
    }),
  }
}

export async function portfolioHistory(context: Context, from?: string | null, to?: string | null) {
  let query = context.supabase
    .from('portfolio_snapshots')
    .select('date, total_value, total_invested, updated_at')
    .eq('user_id', context.user.id)
    .order('date', { ascending: true })
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)
  const { data, error } = await query
  databaseFailure('cargar el historial', error)
  return (data ?? []).map((point) => ({
    date: point.date,
    value: decimal(point.total_value),
    invested: decimal(point.total_invested),
    updatedAt: point.updated_at,
  }))
}

type DecimalParts = { coefficient: bigint; scale: number }

function decimalParts(value: string): DecimalParts {
  const [integer, fraction = ''] = value.split('.')
  return { coefficient: BigInt(`${integer}${fraction}`), scale: fraction.length }
}

function decimalString(parts: DecimalParts): string {
  if (parts.coefficient === BigInt(0)) return '0'
  const negative = parts.coefficient < BigInt(0)
  const digits = (negative ? -parts.coefficient : parts.coefficient).toString()
  const padded = parts.scale >= digits.length ? digits.padStart(parts.scale + 1, '0') : digits
  const split = padded.length - parts.scale
  const raw = parts.scale === 0 ? padded : `${padded.slice(0, split)}.${padded.slice(split)}`
  const normalized = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw
  return negative ? `-${normalized}` : normalized
}

function addDecimals(left: DecimalParts, right: DecimalParts, subtract = false): DecimalParts {
  const scale = Math.max(left.scale, right.scale)
  const leftCoefficient = left.coefficient * BigInt(10) ** BigInt(scale - left.scale)
  const rightCoefficient = right.coefficient * BigInt(10) ** BigInt(scale - right.scale)
  return {
    coefficient: leftCoefficient + (subtract ? -rightCoefficient : rightCoefficient),
    scale,
  }
}

function multiplyDecimals(left: DecimalParts, right: DecimalParts): DecimalParts {
  return { coefficient: left.coefficient * right.coefficient, scale: left.scale + right.scale }
}

function derivedCashImpact(input: ReturnType<typeof TransactionInputSchema.parse>) {
  const commission = decimalParts(input.commission)
  const sourceWithholding = decimalParts(input.sourceWithholding)
  const destinationWithholding = decimalParts(input.destinationWithholding)
  let operation: 'Compra' | 'Venta'
  let amount: DecimalParts

  switch (input.operation) {
    case 'Compra':
      operation = 'Venta'
      amount = addDecimals(
        multiplyDecimals(decimalParts(input.quantity), decimalParts(input.unitPrice)),
        commission,
      )
      break
    case 'Venta':
      operation = 'Compra'
      amount = addDecimals(
        addDecimals(
          addDecimals(
            multiplyDecimals(decimalParts(input.quantity), decimalParts(input.unitPrice)),
            sourceWithholding,
            true,
          ),
          destinationWithholding,
          true,
        ),
        commission,
        true,
      )
      break
    case 'Dividendo':
      operation = 'Compra'
      amount = addDecimals(
        addDecimals(
          addDecimals(decimalParts(input.unitPrice), sourceWithholding, true),
          destinationWithholding,
          true,
        ),
        commission,
        true,
      )
      break
    default:
      return null
  }

  if (amount.coefficient <= BigInt(0)) return null
  return { operation, amount: decimalString(amount) }
}

const TransactionCursorSchema = TransactionInputSchema.pick({ date: true }).extend({
  createdAt: z.string().datetime(),
  id: IdSchema,
})

function encodeTransactionCursor(row: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify({
    date: row.fecha,
    createdAt: row.created_at,
    id: row.id,
  })).toString('base64url')
}

function decodeTransactionCursor(cursor: string) {
  try {
    return TransactionCursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))
  } catch {
    throw new MobileApiError(400, 'validation_error', 'Cursor de movimientos inválido')
  }
}

async function transactionSearchAssetIds(context: Context, query: string): Promise<string[]> {
  const pattern = `*${query}*`
  const { data, error } = await context.supabase
    .from('activos')
    .select('id')
    .eq('user_id', context.user.id)
    .or(`ticker.ilike.${pattern},nombre.ilike.${pattern}`)
    .limit(100)
  databaseFailure('buscar activos de movimientos', error)
  return (data ?? []).map((asset) => asset.id)
}

export async function listTransactions(context: Context, options: TransactionListQuery) {
  let searchAssetIds: string[] = []
  if (options.query) searchAssetIds = await transactionSearchAssetIds(context, options.query)

  const cursor = options.mode === 'cursor' && options.cursor
    ? decodeTransactionCursor(options.cursor)
    : null
  let request = context.supabase
    .from('transacciones')
    .select(
      '*, activo:activos(ticker, nombre, tipo, moneda)',
      options.mode === 'offset' ? { count: 'exact' } : undefined,
    )
    .eq('user_id', context.user.id)
    .is('linked_transaction_id', null)

  if (options.assetId) request = request.eq('activo_id', options.assetId)
  if (options.operation) request = request.eq('tipo_operacion', options.operation)
  if (options.year) {
    request = request
      .gte('fecha', `${options.year}-01-01`)
      .lt('fecha', `${options.year + 1}-01-01`)
  }
  if (options.query) {
    const pattern = `*${options.query}*`
    const assetFilter = searchAssetIds.length > 0 ? `,activo_id.in.(${searchAssetIds.join(',')})` : ''
    request = request.or(`tipo_operacion.ilike.${pattern},notas.ilike.${pattern}${assetFilter}`)
  }
  if (cursor) {
    request = request.or([
      `fecha.lt.${cursor.date}`,
      `and(fecha.eq.${cursor.date},created_at.lt.${cursor.createdAt})`,
      `and(fecha.eq.${cursor.date},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    ].join(','))
  }

  request = request
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  const pageSize = options.mode === 'cursor' ? options.limit : options.pageSize
  const start = options.mode === 'offset' ? (options.page - 1) * options.pageSize : 0
  const end = options.mode === 'cursor' ? pageSize : start + pageSize - 1
  const { data, error, count } = await request.range(start, end)
  databaseFailure('cargar los movimientos', error)

  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  if (options.mode === 'cursor') {
    const hasMore = rows.length > options.limit
    const visibleRows = hasMore ? rows.slice(0, options.limit) : rows
    return {
      items: visibleRows.map(transactionDto),
      limit: options.limit,
      hasMore,
      nextCursor: hasMore && visibleRows.length > 0
        ? encodeTransactionCursor(visibleRows[visibleRows.length - 1])
        : null,
    }
  }

  return {
    items: rows.map(transactionDto),
    page: options.page,
    pageSize: options.pageSize,
    total: count ?? 0,
  }
}

function transactionPayload(input: ReturnType<typeof TransactionInputSchema.parse>) {
  return {
    activo_id: input.assetId,
    tipo_operacion: input.operation,
    cantidad: input.quantity,
    precio_unitario: input.unitPrice,
    comision: input.commission,
    retencion_origen: input.sourceWithholding,
    retencion_destino: input.destinationWithholding,
    estado: input.status,
    fecha: input.date,
    notas: input.notes ?? null,
  }
}

export async function createTransaction(context: Context, input: unknown) {
  const parsed = TransactionInputSchema.parse(input)
  const cashImpact = parsed.cashImpact ?? (parsed.updateCash ? derivedCashImpact(parsed) : null)
  const { data, error } = await context.supabase.rpc('create_transaction_with_cash', {
    p_transaction: transactionPayload(parsed),
    p_cash_operation: cashImpact?.operation ?? null,
    p_cash_amount: (cashImpact?.amount ?? null) as unknown as number | null,
  })
  databaseFailure('crear el movimiento', error)
  return transactionDto(data as unknown as Record<string, unknown>)
}

async function getTransactionRow(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from('transacciones')
    .select('*')
    .eq('id', id)
    .eq('user_id', context.user.id)
    .is('linked_transaction_id', null)
    .maybeSingle()
  databaseFailure('cargar el movimiento', error)
  if (!data) throw new MobileApiError(404, 'transaction_not_found', 'Movimiento no encontrado')
  return data
}

export async function updateTransaction(context: Context, id: string, input: unknown) {
  const current = await getTransactionRow(context, id)
  const parsed = TransactionPatchSchema.parse(input)
  const explicitlyUpdatesCash = typeof input === 'object' && input !== null && (
    Object.prototype.hasOwnProperty.call(input, 'cashImpact')
    || Object.prototype.hasOwnProperty.call(input, 'updateCash')
  )
  let cashImpact = parsed.cashImpact
  if (!explicitlyUpdatesCash) {
    const { data: linkedCash, error: linkedCashError } = await context.supabase
      .from('transacciones')
      .select('tipo_operacion, cantidad')
      .eq('linked_transaction_id', id)
      .eq('user_id', context.user.id)
      .maybeSingle()
    databaseFailure('cargar el impacto en liquidez', linkedCashError)
    cashImpact = linkedCash && (linkedCash.tipo_operacion === 'Compra' || linkedCash.tipo_operacion === 'Venta')
      ? { operation: linkedCash.tipo_operacion, amount: DecimalInputSchema.parse(linkedCash.cantidad) }
      : null
  }
  const merged = TransactionInputSchema.parse({
    assetId: parsed.assetId ?? current.activo_id,
    operation: parsed.operation ?? current.tipo_operacion,
    quantity: parsed.quantity ?? current.cantidad,
    unitPrice: parsed.unitPrice ?? current.precio_unitario,
    commission: parsed.commission ?? current.comision,
    sourceWithholding: parsed.sourceWithholding ?? current.retencion_origen ?? 0,
    destinationWithholding: parsed.destinationWithholding ?? current.retencion_destino ?? 0,
    status: parsed.status ?? current.estado,
    date: parsed.date ?? current.fecha,
    notes: parsed.notes === undefined ? current.notas : parsed.notes,
    updateCash: parsed.updateCash ?? false,
    cashImpact,
  })
  if (explicitlyUpdatesCash) {
    cashImpact = parsed.cashImpact ?? (parsed.updateCash ? derivedCashImpact(merged) : null)
  }
  const { data, error } = await context.supabase.rpc('update_transaction_with_cash', {
    p_transaction_id: id,
    p_transaction: transactionPayload(merged),
    p_cash_operation: cashImpact?.operation ?? null,
    p_cash_amount: (cashImpact?.amount ?? null) as unknown as number | null,
  })
  databaseFailure('actualizar el movimiento', error)
  return transactionDto(data as unknown as Record<string, unknown>)
}

export async function deleteTransaction(context: Context, id: string) {
  await getTransactionRow(context, id)
  const { error } = await context.supabase
    .from('transacciones')
    .delete()
    .eq('id', id)
    .eq('user_id', context.user.id)
    .is('linked_transaction_id', null)
  databaseFailure('eliminar el movimiento', error)
}

export async function createTransfer(context: Context, input: unknown) {
  const parsed = TransferInputSchema.parse(input)
  const { data, error } = await context.supabase.rpc('create_fund_transfer', {
    p_source_transaction: transactionPayload({ ...parsed.source, updateCash: false, cashImpact: undefined }),
    p_destination_transaction: transactionPayload({ ...parsed.destination, updateCash: false, cashImpact: undefined }),
  })
  databaseFailure('crear el traspaso', error)
  return data
}

export async function listAlerts(context: Context) {
  const { data, error } = await context.supabase
    .from('alertas').select('*').eq('user_id', context.user.id).order('created_at', { ascending: false })
  databaseFailure('cargar las alertas', error)
  return (data ?? []).map((row) => alertDto(row as unknown as Record<string, unknown>))
}

export async function createAlert(context: Context, input: unknown) {
  const parsed = AlertInputSchema.parse(input)
  const { data, error } = await context.supabase.from('alertas').insert({
    user_id: context.user.id,
    ticker: parsed.ticker,
    target_price: parsed.targetPrice as unknown as number,
    condition: parsed.condition,
  }).select().single()
  databaseFailure('crear la alerta', error)
  return alertDto(data as unknown as Record<string, unknown>)
}

export async function updateAlert(context: Context, id: string, input: unknown) {
  const parsed = AlertPatchSchema.parse(input)
  const changes = {
    ...(parsed.ticker === undefined ? {} : { ticker: parsed.ticker }),
    ...(parsed.targetPrice === undefined ? {} : { target_price: parsed.targetPrice as unknown as number }),
    ...(parsed.condition === undefined ? {} : { condition: parsed.condition }),
    ...(parsed.triggered === undefined ? {} : { triggered: parsed.triggered }),
  }
  const { data, error } = await context.supabase.from('alertas').update(changes)
    .eq('id', id).eq('user_id', context.user.id).select().maybeSingle()
  databaseFailure('actualizar la alerta', error)
  if (!data) throw new MobileApiError(404, 'alert_not_found', 'Alerta no encontrada')
  return alertDto(data as unknown as Record<string, unknown>)
}

export async function deleteAlert(context: Context, id: string) {
  const { data, error } = await context.supabase.from('alertas').delete()
    .eq('id', id).eq('user_id', context.user.id).select('id').maybeSingle()
  databaseFailure('eliminar la alerta', error)
  if (!data) throw new MobileApiError(404, 'alert_not_found', 'Alerta no encontrada')
}

export async function listEvents(context: Context) {
  const { data, error } = await context.supabase.from('eventos_recurrentes')
    .select('*, activo:activos(ticker, nombre, tipo)').eq('user_id', context.user.id)
    .order('dia_del_mes', { ascending: true })
  databaseFailure('cargar los eventos', error)
  return (data ?? []).map((row) => eventDto(row as unknown as Record<string, unknown>))
}

async function ensureOwnedAsset(context: Context, assetId: string) {
  const { data, error } = await context.supabase.from('activos').select('id')
    .eq('id', assetId).eq('user_id', context.user.id).maybeSingle()
  databaseFailure('validar el activo', error)
  if (!data) throw new MobileApiError(404, 'asset_not_found', 'Activo no encontrado')
}

export async function createEvent(context: Context, input: unknown) {
  const parsed = EventInputSchema.parse(input)
  await ensureOwnedAsset(context, parsed.assetId)
  const { data, error } = await context.supabase.from('eventos_recurrentes').insert({
    user_id: context.user.id, activo_id: parsed.assetId, titulo: parsed.title,
    dia_del_mes: parsed.dayOfMonth, tipo: parsed.type,
  }).select('*, activo:activos(ticker, nombre, tipo)').single()
  databaseFailure('crear el evento', error)
  return eventDto(data as unknown as Record<string, unknown>)
}

export async function updateEvent(context: Context, id: string, input: unknown) {
  const parsed = EventInputSchema.partial().parse(input)
  if (parsed.assetId) await ensureOwnedAsset(context, parsed.assetId)
  const { data, error } = await context.supabase.from('eventos_recurrentes').update({
    ...(parsed.assetId === undefined ? {} : { activo_id: parsed.assetId }),
    ...(parsed.title === undefined ? {} : { titulo: parsed.title }),
    ...(parsed.dayOfMonth === undefined ? {} : { dia_del_mes: parsed.dayOfMonth }),
    ...(parsed.type === undefined ? {} : { tipo: parsed.type }),
  }).eq('id', id).eq('user_id', context.user.id)
    .select('*, activo:activos(ticker, nombre, tipo)').maybeSingle()
  databaseFailure('actualizar el evento', error)
  if (!data) throw new MobileApiError(404, 'event_not_found', 'Evento no encontrado')
  return eventDto(data as unknown as Record<string, unknown>)
}

export async function deleteEvent(context: Context, id: string) {
  const { data, error } = await context.supabase.from('eventos_recurrentes').delete()
    .eq('id', id).eq('user_id', context.user.id).select('id').maybeSingle()
  databaseFailure('eliminar el evento', error)
  if (!data) throw new MobileApiError(404, 'event_not_found', 'Evento no encontrado')
}

function settingsDto(row: Record<string, unknown> | null) {
  return {
    pushNotifications: (row?.push_notifs as boolean | undefined) ?? false,
    emailNotifications: (row?.email_notifs as boolean | undefined) ?? true,
    priceAlerts: (row?.price_alerts as boolean | undefined) ?? true,
    weeklyReport: (row?.weekly_report as boolean | undefined) ?? false,
    dividendAlerts: (row?.dividend_alerts as boolean | undefined) ?? true,
    updatedAt: row?.updated_at ?? null,
  }
}

export async function getSettings(context: Context) {
  const { data, error } = await context.supabase.from('notification_preferences').select('*')
    .eq('user_id', context.user.id).maybeSingle()
  databaseFailure('cargar los ajustes', error)
  return settingsDto(data as unknown as Record<string, unknown> | null)
}

export async function updateSettings(context: Context, input: unknown) {
  const parsed = SettingsInputSchema.parse(input)
  const { data, error } = await context.supabase.from('notification_preferences').upsert({
    user_id: context.user.id,
    ...(parsed.pushNotifications === undefined ? {} : { push_notifs: parsed.pushNotifications }),
    ...(parsed.emailNotifications === undefined ? {} : { email_notifs: parsed.emailNotifications }),
    ...(parsed.priceAlerts === undefined ? {} : { price_alerts: parsed.priceAlerts }),
    ...(parsed.weeklyReport === undefined ? {} : { weekly_report: parsed.weeklyReport }),
    ...(parsed.dividendAlerts === undefined ? {} : { dividend_alerts: parsed.dividendAlerts }),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }).select().single()
  databaseFailure('actualizar los ajustes', error)
  return settingsDto(data as unknown as Record<string, unknown>)
}

export async function searchMarket(query: string) {
  if (!query.trim() || query.length > 100) throw new MobileApiError(400, 'validation_error', 'Consulta inválida')
  const result = await getYahooFinance().search(query.trim())
  return result.quotes.filter((quote) => quote.isYahooFinance).slice(0, 20).map((quote) => ({
    ticker: quote.symbol,
    name: quote.longname || quote.shortname || quote.symbol,
    exchange: quote.exchDisp ?? null,
    type: quote.quoteType ?? null,
  }))
}

function newsDto(news: {
  uuid: string
  title: string
  publisher: string
  link: string
  providerPublishTime: Date
  relatedTickers?: string[]
}, fallbackTicker?: string) {
  return {
    id: news.uuid,
    title: news.title,
    source: news.publisher,
    publishedAt: news.providerPublishTime.toISOString(),
    url: news.link,
    ticker: news.relatedTickers?.[0] ?? fallbackTicker ?? null,
  }
}

export async function marketNews(context: Context, ticker?: string | null) {
  const requestedTicker = ticker?.trim()
  if (requestedTicker && requestedTicker.length > 30) {
    throw new MobileApiError(400, 'validation_error', 'Ticker inválido')
  }

  let tickers: string[]
  if (requestedTicker) {
    tickers = [requestedTicker]
  } else {
    const { data, error } = await context.supabase
      .from('activos')
      .select('ticker')
      .eq('user_id', context.user.id)
      .neq('ticker', 'CASH')
      .limit(8)
    databaseFailure('cargar los tickers del radar', error)
    tickers = Array.from(new Set((data ?? []).map((asset) => asset.ticker).filter(Boolean)))
  }

  if (tickers.length === 0) return []
  const batches = await mapSettledWithConcurrency(tickers, 4, async (currentTicker) => {
    const result = await getYahooFinance().search(currentTicker, { newsCount: requestedTicker ? 20 : 5 })
    return result.news.map((news) => newsDto(news, currentTicker))
  })

  const unique = new Map<string, ReturnType<typeof newsDto>>()
  for (const batch of batches) {
    if (batch.status !== 'fulfilled') continue
    for (const item of batch.value) unique.set(item.id, item)
  }
  return Array.from(unique.values())
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, 20)
}
