import { describe, expect, it } from 'vitest'
import {
  apiErrorSchema,
  revolutImportSuccessSchema,
} from '@/lib/domain/imports/revolut-response'

describe('Revolut import API contract', () => {
  it('accepts a complete successful import summary', () => {
    const result = revolutImportSuccessSchema.safeParse({
      success: true,
      newTransactions: 1,
      updatedTransactions: 0,
      ignoredDuplicates: 1,
      removedInternalMovements: 0,
      imported: [{
        ticker: 'AAPL',
        tipo_operacion: 'Compra',
        cantidad: 2,
        precio_unitario: 205.5,
        fecha: '2026-07-13',
      }],
      ignored: [],
    })

    expect(result.success).toBe(true)
  })

  it('rejects malformed server payloads instead of leaking them into the UI', () => {
    const result = revolutImportSuccessSchema.safeParse({
      success: true,
      newTransactions: '1',
      imported: null,
    })

    expect(result.success).toBe(false)
  })

  it('accepts the shared API error shape', () => {
    expect(apiErrorSchema.parse({ error: 'Archivo no válido' })).toEqual({
      error: 'Archivo no válido',
    })
  })
})

