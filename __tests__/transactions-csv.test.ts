import { describe, expect, it } from 'vitest'
import { buildTransactionsCsvFilename, transactionsToCsv } from '@/lib/utils/transactions-csv'
import type { Transaccion } from '@/lib/types'

describe('transactions CSV export', () => {
  it('escapes commas, quotes and line breaks', () => {
    const tx: Transaccion = {
      id: 'tx-1',
      activo_id: 'asset-1',
      tipo_operacion: 'Compra',
      cantidad: 1.5,
      precio_unitario: 10,
      comision: 0.5,
      retencion_origen: 0,
      retencion_destino: 0,
      estado: 'Completada',
      fecha: '2026-07-13',
      notas: 'nota con, coma y "comillas"\nsegunda linea',
      created_at: '2026-07-13T10:00:00.000Z',
      activo: {
        ticker: 'ABC',
        nombre: 'Empresa, SA',
        tipo: 'Acción',
        moneda: 'EUR',
      },
    }

    const csv = transactionsToCsv([tx])

    expect(csv).toContain('"Empresa, SA"')
    expect(csv).toContain('"nota con, coma y ""comillas""\nsegunda linea"')
  })

  it('builds stable dated filenames', () => {
    expect(buildTransactionsCsvFilename(new Date('2026-07-13T10:00:00Z'))).toBe('silox-transacciones-2026-07-13.csv')
  })
})
