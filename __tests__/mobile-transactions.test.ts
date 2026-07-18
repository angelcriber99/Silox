import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/actions/market', () => ({ fetchMarketPricesDirect: vi.fn() }))
vi.mock('@/lib/server/yahoo-finance', () => ({ getYahooFinance: vi.fn() }))

import {
  DecimalInputSchema,
  TransactionInputSchema,
  TransactionListQuerySchema,
  TransactionPatchSchema,
} from '@/lib/mobile/schemas'
import { createTransaction, listTransactions, updateTransaction } from '@/lib/mobile/services'

const ASSET_ID = '11111111-1111-4111-8111-111111111111'

function transactionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    activo_id: ASSET_ID,
    tipo_operacion: 'Compra',
    cantidad: 1,
    precio_unitario: 10,
    comision: 0,
    retencion_origen: 0,
    retencion_destino: 0,
    estado: 'Completada',
    fecha: '2026-07-18',
    notas: null,
    created_at: '2026-07-18T10:00:00.000Z',
    linked_transaction_id: null,
    ...overrides,
  }
}

function mutationContext() {
  const rpc = vi.fn().mockResolvedValue({ data: transactionRow(), error: null })
  return { rpc, context: { user: { id: 'user-1' }, supabase: { rpc } } as never }
}

describe('mobile transaction decimal and cash contract', () => {
  it('accepts canonical strings and legacy numbers while rejecting non-canonical strings', () => {
    expect(DecimalInputSchema.parse('0.00000001')).toBe('0.00000001')
    expect(DecimalInputSchema.parse(1e-8)).toBe('0.00000001')
    expect(() => DecimalInputSchema.parse('01.00')).toThrow()
    expect(() => DecimalInputSchema.parse('1.0')).toThrow()
    expect(TransactionInputSchema.parse({
      assetId: ASSET_ID, operation: 'Compra', quantity: 1, unitPrice: 10, date: '2026-07-18',
    })).toMatchObject({ quantity: '1', unitPrice: '10', commission: '0', updateCash: false })
    expect(TransactionPatchSchema.parse({ notes: 'solo notas' })).toEqual({ notes: 'solo notas' })
  })

  it('derives an exact purchase cash withdrawal without converting through number', async () => {
    const { rpc, context } = mutationContext()
    await createTransaction(context, {
      assetId: ASSET_ID,
      operation: 'Compra',
      quantity: '0.00000003',
      unitPrice: '123456789.12345678',
      commission: '0.00000001',
      date: '2026-07-18',
      updateCash: true,
    })

    expect(rpc).toHaveBeenCalledWith('create_transaction_with_cash', expect.objectContaining({
      p_transaction: expect.objectContaining({
        cantidad: '0.00000003', precio_unitario: '123456789.12345678', comision: '0.00000001',
      }),
      p_cash_operation: 'Venta',
      p_cash_amount: '3.7037036837037034',
    }))
  })

  it('subtracts fees and both withholdings from sales and dividends', async () => {
    const sale = mutationContext()
    await createTransaction(sale.context, {
      assetId: ASSET_ID, operation: 'Venta', quantity: '2', unitPrice: '50',
      commission: '1', sourceWithholding: '2', destinationWithholding: '3',
      date: '2026-07-18', updateCash: true,
    })
    expect(sale.rpc).toHaveBeenCalledWith('create_transaction_with_cash', expect.objectContaining({
      p_cash_operation: 'Compra', p_cash_amount: '94',
    }))

    const dividend = mutationContext()
    await createTransaction(dividend.context, {
      assetId: ASSET_ID, operation: 'Dividendo', quantity: '25', unitPrice: '20',
      commission: '1', sourceWithholding: '2', destinationWithholding: '3',
      date: '2026-07-18', updateCash: true,
    })
    expect(dividend.rpc).toHaveBeenCalledWith('create_transaction_with_cash', expect.objectContaining({
      p_cash_operation: 'Compra', p_cash_amount: '14',
    }))
  })

  it('preserves explicit legacy cashImpact precedence', async () => {
    const { rpc, context } = mutationContext()
    await createTransaction(context, {
      assetId: ASSET_ID, operation: 'Compra', quantity: 2, unitPrice: 50,
      date: '2026-07-18', updateCash: true,
      cashImpact: { operation: 'Compra', amount: 7.5 },
    })
    expect(rpc).toHaveBeenCalledWith('create_transaction_with_cash', expect.objectContaining({
      p_cash_operation: 'Compra', p_cash_amount: '7.5',
    }))
  })

  it('derives cash from the merged patch without resetting omitted financial fields', async () => {
    const current = transactionRow({ cantidad: 2, precio_unitario: 50, comision: 1 })
    const maybeSingle = vi.fn().mockResolvedValue({ data: current, error: null })
    const builder: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'eq', 'is']) builder[method] = vi.fn(() => builder)
    builder.maybeSingle = maybeSingle
    const rpc = vi.fn().mockResolvedValue({ data: current, error: null })
    const context = {
      user: { id: 'user-1' },
      supabase: { from: vi.fn(() => builder), rpc },
    } as never

    await updateTransaction(context, current.id, { notes: 'actualizada', updateCash: true })

    expect(rpc).toHaveBeenCalledWith('update_transaction_with_cash', expect.objectContaining({
      p_transaction: expect.objectContaining({
        cantidad: '2', precio_unitario: '50', comision: '1', notas: 'actualizada',
      }),
      p_cash_operation: 'Venta',
      p_cash_amount: '101',
    }))
  })
})

function fluentTransactionQuery(result: Record<string, unknown>) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'is', 'gte', 'lt', 'or', 'order']) {
    query[method] = vi.fn(() => query)
  }
  query.range = vi.fn().mockResolvedValue(result)
  return query
}

describe('mobile transaction pagination and filters', () => {
  it('keeps legacy offset pagination and applies server-side filters', async () => {
    const builder = fluentTransactionQuery({ data: [transactionRow()], error: null, count: 1 })
    const context = { user: { id: 'user-1' }, supabase: { from: vi.fn(() => builder) } } as never
    const options = TransactionListQuerySchema.parse({
      page: '2', pageSize: '25', year: '2026', operation: 'Compra', assetId: ASSET_ID,
    })

    const result = await listTransactions(context, options)

    expect(builder.eq).toHaveBeenCalledWith('activo_id', ASSET_ID)
    expect(builder.eq).toHaveBeenCalledWith('tipo_operacion', 'Compra')
    expect(builder.gte).toHaveBeenCalledWith('fecha', '2026-01-01')
    expect(builder.lt).toHaveBeenCalledWith('fecha', '2027-01-01')
    expect(builder.range).toHaveBeenCalledWith(25, 49)
    expect(result).toMatchObject({ page: 2, pageSize: 25, total: 1 })
  })

  it('returns an opaque continuation cursor and requests limit plus one', async () => {
    const rows = [
      transactionRow(),
      transactionRow({ id: '33333333-3333-4333-8333-333333333333', created_at: '2026-07-18T09:00:00.000Z' }),
      transactionRow({ id: '44444444-4444-4444-8444-444444444444', created_at: '2026-07-18T08:00:00.000Z' }),
    ]
    const firstBuilder = fluentTransactionQuery({ data: rows, error: null })
    const firstContext = { user: { id: 'user-1' }, supabase: { from: vi.fn(() => firstBuilder) } } as never
    const first = await listTransactions(firstContext, TransactionListQuerySchema.parse({ limit: '2' }))

    expect(firstBuilder.range).toHaveBeenCalledWith(0, 2)
    expect(first).toMatchObject({ limit: 2, hasMore: true })
    expect('nextCursor' in first && first.nextCursor).toEqual(expect.any(String))

    const secondBuilder = fluentTransactionQuery({ data: [], error: null })
    const secondContext = { user: { id: 'user-1' }, supabase: { from: vi.fn(() => secondBuilder) } } as never
    await listTransactions(secondContext, TransactionListQuerySchema.parse({
      limit: '2', cursor: 'nextCursor' in first ? first.nextCursor ?? undefined : undefined,
    }))
    expect(secondBuilder.or).toHaveBeenCalledWith(expect.stringContaining('created_at.lt.2026-07-18T09:00:00.000Z'))
  })

  it('searches owned asset names and applies the resulting ids with operation and notes', async () => {
    const assetBuilder: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'eq', 'or']) assetBuilder[method] = vi.fn(() => assetBuilder)
    assetBuilder.limit = vi.fn().mockResolvedValue({ data: [{ id: ASSET_ID }], error: null })
    const transactionBuilder = fluentTransactionQuery({ data: [], error: null, count: 0 })
    const from = vi.fn((table: string) => table === 'activos' ? assetBuilder : transactionBuilder)
    const context = { user: { id: 'user-1' }, supabase: { from } } as never

    await listTransactions(context, TransactionListQuerySchema.parse({ query: 'Apple' }))

    expect(assetBuilder.or).toHaveBeenCalledWith('ticker.ilike.*Apple*,nombre.ilike.*Apple*')
    expect(transactionBuilder.or).toHaveBeenCalledWith(
      `tipo_operacion.ilike.*Apple*,notas.ilike.*Apple*,activo_id.in.(${ASSET_ID})`,
    )
  })
})
