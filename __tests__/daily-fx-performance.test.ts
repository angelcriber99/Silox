import { describe, expect, it } from 'vitest'

import { enrichPositions } from '@/lib/api/assets'
import type { Posicion } from '@/lib/types'

const position: Posicion = {
  activo_id: 'asset-1',
  ticker: 'TEST',
  isin: null,
  nombre: 'Test USD',
  tipo: 'Acción',
  estrategia: 'Core',
  moneda: 'USD',
  sector: 'Test',
  geografia: 'USA',
  unidades: 10,
  coste_total: 1_000,
  comisiones_total: 0,
  num_operaciones: 1,
  ultima_operacion: null,
  notas: null,
}

describe('daily P&L currency conversion', () => {
  it('includes the EUR/USD movement between the previous close and the current quote', () => {
    const [result] = enrichPositions([position], {
      prices: {
        TEST: {
          price: 100,
          originalPrice: 110,
          originalCurrency: 'USD',
          sparkline: [],
          dailyChangePercent24h: 10,
        },
      },
      fxRates: { EUR: 1, USD: 1.1 },
      fxPreviousRates: { EUR: 1, USD: 1 },
    })

    // Native price rises from $100 to $110, but EUR/USD also moves from 1.0
    // to 1.1, leaving the EUR portfolio value unchanged.
    expect(result.change_amount_24h).toBeCloseTo(0)
  })
})
