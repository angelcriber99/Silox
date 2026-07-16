"use server"

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { TransaccionSchema } from '@/lib/validations/schemas'
import type { Transaccion } from '@/lib/types'
import { fetchMarketPrices } from '@/lib/actions/market'
import { calculateCashMovement } from '@/lib/domain/transactions/cash-movement'

const TransactionMutationSchema = TransaccionSchema.extend({
  use_efectivo: z.boolean().optional(),
})

type TransactionMutation = z.infer<typeof TransactionMutationSchema>
type FxRates = Record<string, number>

interface StoredTransaction {
  id: string
  activo_id: string
  tipo_operacion: Transaccion['tipo_operacion']
  cantidad: number
  precio_unitario: number
  comision: number
  retencion_origen: number | null
  retencion_destino: number | null
  estado: 'Completada' | 'Pendiente' | null
  fecha: string
  notas: string | null
}

function convertCurrency(
  amount: number,
  sourceCurrency: string | undefined,
  targetCurrency: string,
  fxRates: FxRates,
) {
  if (!sourceCurrency || sourceCurrency === targetCurrency) return amount
  if (sourceCurrency === 'EUR') return amount * (fxRates[targetCurrency] ?? 1)
  if (targetCurrency === 'EUR') return amount / (fxRates[sourceCurrency] ?? 1)

  const amountInEur = amount / (fxRates[sourceCurrency] ?? 1)
  return amountInEur * (fxRates[targetCurrency] ?? 1)
}

async function prepareMonetaryValues(
  input: Partial<TransactionMutation>,
  assetCurrency: string,
  fallbackNotes: string | null = null,
) {
  const convertsPrice = input.precio_unitario !== undefined
    && input.precio_moneda !== undefined
    && input.precio_moneda !== assetCurrency
  const convertsCommission = input.comision !== undefined
    && input.comision_moneda !== undefined
    && input.comision_moneda !== assetCurrency
  const fxRates = convertsPrice || convertsCommission
    ? (await fetchMarketPrices([], true)).fxRates ?? {}
    : {}
  const notes: string[] = []

  const price = input.precio_unitario === undefined
    ? undefined
    : convertCurrency(
        input.precio_unitario,
        input.precio_moneda,
        assetCurrency,
        fxRates,
      )
  if (convertsPrice && input.precio_unitario !== undefined) {
    notes.push(`(Precio orig: ${input.precio_unitario.toFixed(2)} ${input.precio_moneda})`)
  }

  const commission = input.comision === undefined
    ? undefined
    : convertCurrency(
        input.comision,
        input.comision_moneda,
        assetCurrency,
        fxRates,
      )
  if (convertsCommission && input.comision !== undefined) {
    notes.push(`(Comisión orig: ${input.comision.toFixed(2)} ${input.comision_moneda})`)
  }

  const baseNotes = input.notas ?? fallbackNotes ?? ''
  const conversionNotes = notes.join(' | ')

  return {
    price,
    commission,
    notes: [baseNotes, conversionNotes].filter(Boolean).join(' '),
  }
}

async function getOwnedAssetCurrency(assetId: string, userId: string) {
  const supabase = await createClient()
  const { data: asset, error } = await supabase
    .from('activos')
    .select('id, moneda')
    .eq('id', assetId)
    .eq('user_id', userId)
    .single()

  if (error || !asset) throw new Error('Activo no encontrado o no autorizado')
  return asset.moneda as string
}

function getCashMovement(transaction: {
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  comision: number
  retencion_origen?: number | null
  retencion_destino?: number | null
}) {
  return calculateCashMovement({
    operation: transaction.tipo_operacion,
    quantity: transaction.cantidad,
    unitPrice: transaction.precio_unitario,
    commission: transaction.comision,
    withholdingOrigin: transaction.retencion_origen ?? 0,
    withholdingDestination: transaction.retencion_destino ?? 0,
  })
}

export async function insertTransaccionAction(formData: unknown): Promise<Transaccion> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No estás autenticado')

    const validated = TransactionMutationSchema.parse(formData)
    const assetCurrency = await getOwnedAssetCurrency(validated.activo_id, user.id)
    const monetary = await prepareMonetaryValues(validated, assetCurrency)
    const transaction = {
      activo_id: validated.activo_id,
      tipo_operacion: validated.tipo_operacion,
      cantidad: validated.cantidad,
      precio_unitario: monetary.price ?? validated.precio_unitario,
      comision: monetary.commission ?? validated.comision,
      retencion_origen: validated.retencion_origen ?? 0,
      retencion_destino: validated.retencion_destino ?? 0,
      estado: validated.estado ?? 'Completada',
      fecha: validated.fecha,
      notas: monetary.notes || null,
    }
    const cash = validated.use_efectivo ? getCashMovement(transaction) : null

    const { data, error } = await supabase.rpc('create_transaction_with_cash', {
      p_transaction: transaction,
      p_cash_operation: cash?.operation ?? null,
      p_cash_amount: cash?.amount ?? null,
    })

    if (error) throw new Error(`Error registrando transacción: ${error.message} | ${error.details} | ${error.hint}`)
    return data as Transaccion
  } catch (e: any) {
    return { id: "ERROR", notas: String(e.stack || e.message || e) } as any
  }
}

export async function updateTransaccionAction(
  id: string,
  formData: unknown,
): Promise<Transaccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const validated = TransactionMutationSchema.partial().parse(formData)
  const { data: currentData, error: currentError } = await supabase
    .from('transacciones')
    .select('id, activo_id, tipo_operacion, cantidad, precio_unitario, comision, retencion_origen, retencion_destino, estado, fecha, notas')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('linked_transaction_id', null)
    .single()

  if (currentError || !currentData) {
    throw new Error('Transacción no encontrada o no autorizada')
  }
  const current = currentData as StoredTransaction
  const assetId = validated.activo_id ?? current.activo_id
  const assetCurrency = await getOwnedAssetCurrency(assetId, user.id)
  const monetary = await prepareMonetaryValues(validated, assetCurrency, current.notas)
  const transaction = {
    activo_id: assetId,
    tipo_operacion: validated.tipo_operacion ?? current.tipo_operacion,
    cantidad: validated.cantidad ?? current.cantidad,
    precio_unitario: monetary.price ?? current.precio_unitario,
    comision: monetary.commission ?? current.comision,
    retencion_origen: validated.retencion_origen ?? current.retencion_origen ?? 0,
    retencion_destino: validated.retencion_destino ?? current.retencion_destino ?? 0,
    estado: validated.estado ?? current.estado ?? 'Completada',
    fecha: validated.fecha ?? current.fecha,
    notas: monetary.notes || null,
  }
  const cash = getCashMovement(transaction)

  const { data, error } = await supabase.rpc('update_transaction_with_cash', {
    p_transaction_id: id,
    p_transaction: transaction,
    p_cash_operation: cash?.operation ?? null,
    p_cash_amount: cash?.amount ?? null,
  })

  if (error) throw new Error(`Error actualizando transacción: ${error.message}`)
  return data as Transaccion
}

export async function deleteTransaccionAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('transacciones')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .is('linked_transaction_id', null)

  if (error) throw new Error(`Error eliminando transacción: ${error.message}`)
}

const TransferLegSchema = TransaccionSchema.pick({
  activo_id: true,
  tipo_operacion: true,
  cantidad: true,
  precio_unitario: true,
  comision: true,
  fecha: true,
  notas: true,
})

const FundTransferSchema = z.object({
  source: TransferLegSchema.extend({
    tipo_operacion: z.literal('Traspaso Salida'),
  }),
  destination: TransferLegSchema.extend({
    tipo_operacion: z.literal('Traspaso Entrada'),
  }),
})

export async function createFundTransferAction(formData: unknown): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const transfer = FundTransferSchema.parse(formData)
  if (transfer.source.activo_id === transfer.destination.activo_id) {
    throw new Error('El activo de origen y destino deben ser diferentes')
  }

  const { error } = await supabase.rpc('create_fund_transfer', {
    p_source_transaction: transfer.source,
    p_destination_transaction: transfer.destination,
  })

  if (error) throw new Error(`Error registrando el traspaso: ${error.message}`)
}
