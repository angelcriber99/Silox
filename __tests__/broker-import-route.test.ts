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

describe('broker import route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
