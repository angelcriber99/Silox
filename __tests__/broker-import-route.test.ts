import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  yahooSearch: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/server/yahoo-finance', () => ({
  getYahooFinance: () => ({ search: mocks.yahooSearch }),
}))

import { POST } from '@/app/api/import/revolut/route'
import { calculateNetContributions } from '@/lib/domain/portfolio/contributions'

interface AssetRow {
  id: string
  ticker: string
  isin: string | null
  tipo: string
  sector: string
  moneda: string
}

interface TransactionRow {
  id: string
  activo_id: string
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  comision: number
  fecha: string
  created_at?: string
  notas?: string
}

function createImportDatabase() {
  const assets: AssetRow[] = []
  const transactions: TransactionRow[] = []
  let assetSequence = 0
  let transactionSequence = 0

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'recreated-user' } } }) },
    from: vi.fn((table: string) => {
      if (table === 'activos') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [...assets], error: null })) })),
          insert: vi.fn((payload: Omit<AssetRow, 'id'>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const asset = { id: `asset-${++assetSequence}`, ...payload }
                assets.push(asset)
                return { data: asset, error: null }
              }),
            })),
          })),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }
      }

      if (table === 'transacciones') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [...transactions], error: null })) })),
          insert: vi.fn(async (rows: Array<Omit<TransactionRow, 'id'>>) => {
            for (const row of rows) transactions.push({ id: `tx-${++transactionSequence}`, ...row })
            return { error: null }
          }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  }

  return { client, assets, transactions }
}

async function statementRequest() {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Órdenes')
  sheet.addRows([
    ['Histórico de órdenes'],
    ['Fecha de la orden', 'ISIN', 'Fondo', 'Tipo de operación', 'Nº de participaciones', 'Importe estimado', 'Estado', 'Gastos', 'Divisa'],
    ['12/07/2026', 'IE00BYX5P602', 'MSCI World Index Fund', 'Suscripción', 10, 120, 'Finalizada', 0, 'EUR'],
    ['13/07/2026', 'IE00BYX5P602', 'MSCI World Index Fund', 'Reembolso', 2, 25, 'Finalizada', 0, 'EUR'],
  ])
  const buffer = await workbook.xlsx.writeBuffer()
  const file = new File([new Uint8Array(buffer)], 'ordenes-myinvestor.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const formData = new FormData()
  formData.append('file', file)
  return { formData: async () => formData } as Request
}

function revolutRequest() {
  const csv = [
    'Date,Ticker,Type,Quantity,Price,Fee,Name',
    '2026-07-12,WYFI,Buy,3.5,37.71,0.25,WhiteFiber Inc.',
    '2026-07-13,WYFI,Sell,0.5,39.00,0.10,WhiteFiber Inc.',
  ].join('\n')
  const file = new File([csv], 'revolut-trades.csv', { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)
  return { formData: async () => formData } as Request
}

function revolutInvestingStatementRequest() {
  const csv = [
    'Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate',
    '2025-03-03T16:03:28.999553Z,,CASH TOP-UP,,,EUR 1000,EUR,1.0000',
    '2025-03-03T16:03:30.810Z,RHM,BUY - MARKET,0.8624407,EUR 1159.50,EUR 1000,EUR,1.0000',
    '2025-05-06T16:15:38.390829Z,RHM,DIVIDEND,,,EUR 1.32,EUR,1.0000',
    '2025-05-07T16:56:26.486057Z,,CASH WITHDRAWAL,,,EUR -20.64,EUR,1.0000',
    '2025-05-08T07:03:33.055027Z,,REWARD,,,EUR 1.16,EUR,1.0000',
    '2025-05-09T07:55:31.556Z,RHM,SELL - MARKET,0.3,EUR 1615,EUR 484.50,EUR,1.0000',
  ].join('\n')
  const file = new File([csv], 'revolut-investing.csv', { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)
  return { formData: async () => formData } as Request
}

describe('broker import route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    mocks.yahooSearch.mockResolvedValue({
      quotes: [{ isYahooFinance: true, symbol: '0P0001AINF.F', quoteType: 'MUTUALFUND', longname: 'MSCI World Index Fund' }],
    })
  })

  it('rebuilds assets and transactions from MyInvestor and is idempotent', async () => {
    const database = createImportDatabase()
    mocks.createClient.mockResolvedValue(database.client)

    const firstResponse = await POST(await statementRequest())
    const first = await firstResponse.json()

    expect(firstResponse.status).toBe(200)
    expect(first).toMatchObject({ success: true, newTransactions: 2, ignoredDuplicates: 0 })
    expect(database.assets).toHaveLength(1)
    expect(database.assets[0]).toMatchObject({ ticker: '0P0001AINF.F', isin: 'IE00BYX5P602', tipo: 'Fondo Indexado' })
    expect(database.transactions).toHaveLength(2)

    const secondResponse = await POST(await statementRequest())
    const second = await secondResponse.json()

    expect(secondResponse.status).toBe(200)
    expect(second).toMatchObject({ success: true, newTransactions: 0, ignoredDuplicates: 2 })
    expect(database.assets).toHaveLength(1)
    expect(database.transactions).toHaveLength(2)
  })

  it('rebuilds Revolut stock trades and ignores the same file on reimport', async () => {
    const database = createImportDatabase()
    mocks.createClient.mockResolvedValue(database.client)

    const first = await (await POST(revolutRequest())).json()
    const second = await (await POST(revolutRequest())).json()

    expect(first).toMatchObject({ success: true, newTransactions: 2, ignoredDuplicates: 0 })
    expect(second).toMatchObject({ success: true, newTransactions: 0, ignoredDuplicates: 2 })
    expect(database.assets).toHaveLength(1)
    expect(database.assets[0]).toMatchObject({ ticker: 'WYFI', tipo: 'Acción' })
    expect(database.transactions.map((transaction) => transaction.tipo_operacion)).toEqual(['Compra', 'Venta'])
  })

  it('imports Revolut investing trades and dividends without reporting cash movements as failures', async () => {
    const database = createImportDatabase()
    mocks.createClient.mockResolvedValue(database.client)

    const first = await (await POST(revolutInvestingStatementRequest())).json()
    const second = await (await POST(revolutInvestingStatementRequest())).json()

    expect(first).toMatchObject({
      success: true,
      newTransactions: 3,
      ignoredDuplicates: 0,
      accountingMovements: 6,
      skipped: [],
    })
    expect(second).toMatchObject({
      success: true,
      newTransactions: 0,
      ignoredDuplicates: 3,
      accountingMovements: 0,
      ignoredAccountingMovements: 6,
    })
    expect(database.assets).toHaveLength(2)
    expect(database.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ ticker: 'RHM', tipo: 'Acción', moneda: 'EUR' }),
      expect.objectContaining({ ticker: 'CASH', tipo: 'Fondo Monetario', estrategia: 'Core', moneda: 'EUR' }),
    ]))
    expect(database.transactions).toHaveLength(9)
    expect(database.transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tipo_operacion: 'Compra',
        cantidad: 0.8624407,
        precio_unitario: 1000 / 0.8624407,
        created_at: '2025-03-03T16:03:30.810Z',
      }),
      expect.objectContaining({ tipo_operacion: 'Dividendo', cantidad: 1, precio_unitario: 1.32 }),
      expect.objectContaining({ tipo_operacion: 'Venta', cantidad: 0.3, precio_unitario: 484.5 / 0.3 }),
    ]))

    const cashAsset = database.assets.find((asset) => asset.ticker === 'CASH')!
    const cashTransactions = database.transactions.filter((transaction) => transaction.activo_id === cashAsset.id)
    const cashBalance = cashTransactions.reduce((total, transaction) =>
      total + (transaction.tipo_operacion === 'Compra' ? transaction.cantidad : -transaction.cantidad), 0)
    expect(cashBalance).toBeCloseTo(466.34, 8)
    expect(calculateNetContributions(cashTransactions)).toBeCloseTo(979.36, 8)
  })

  it('does not duplicate a dividend that was already entered manually', async () => {
    const database = createImportDatabase()
    database.assets.push({
      id: 'asset-manual',
      ticker: 'RHM',
      isin: null,
      tipo: 'Acción',
      sector: 'Desconocido',
      moneda: 'EUR',
    })
    database.transactions.push({
      id: 'dividend-manual',
      activo_id: 'asset-manual',
      tipo_operacion: 'Dividendo',
      cantidad: 0,
      precio_unitario: 1.32,
      comision: 0,
      fecha: '2025-05-06',
    })
    mocks.createClient.mockResolvedValue(database.client)

    const result = await (await POST(revolutInvestingStatementRequest())).json()

    expect(result).toMatchObject({ success: true, newTransactions: 2, ignoredDuplicates: 1 })
    expect(database.transactions.filter((transaction) => transaction.tipo_operacion === 'Dividendo')).toHaveLength(1)
  })

  it('reconciles external metal funding separately from metal-to-cash movements', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      date: '2026-01-01',
      eur: { xpd: 0.001, xag: 0.02 },
    }), { status: 200 })))
    const database = createImportDatabase()
    mocks.createClient.mockResolvedValue(database.client)
    const csv = [
      'Tipo,Producto,Fecha de inicio,Fecha de finalización,Descripción,Importe,Comisión,Divisa,State,Saldo',
      'Cambio,Actual,2026-01-01 10:00:00,2026-01-01 10:00:00,Conversión a XPD,0.200000,0.001000,XPD,COMPLETADO,0.199000',
      'Cambio,Actual,2026-02-01 10:00:00,2026-02-01 10:00:00,Conversión a EUR,-0.100000,0.000000,XPD,COMPLETADO,0.099000',
      'Cambio,Actual,2026-03-01 10:00:00,2026-03-01 10:00:00,Conversión a XAG,-0.050000,0.000000,XPD,COMPLETADO,0.049000',
      'Cambio,Actual,2026-03-01 10:00:00,2026-03-01 10:00:00,Conversión a XAG,1.000000,0.005000,XAG,COMPLETADO,0.995000',
    ].join('\n')
    const formData = new FormData()
    formData.append('file', new File([csv], 'metals.csv', { type: 'text/csv' }))

    const result = await (await POST({ formData: async () => formData } as Request)).json()

    expect(result).toMatchObject({ success: true, newTransactions: 4, accountingMovements: 4 })
    const cashAsset = database.assets.find((asset) => asset.ticker === 'CASH')!
    const cashTransactions = database.transactions.filter((transaction) => transaction.activo_id === cashAsset.id)
    expect(calculateNetContributions(cashTransactions)).toBeCloseTo(100, 8)
    expect(cashTransactions.reduce((total, transaction) =>
      total + (transaction.tipo_operacion === 'Compra' ? transaction.cantidad : -transaction.cantidad), 0)).toBeCloseTo(0, 8)
  })

})
