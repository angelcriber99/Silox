import { describe, expect, it } from 'vitest'

import {
  calculateNetContributions,
  externalFlowNote,
} from '@/lib/domain/portfolio/contributions'
import { computePortfolioTotals, enrichPositions } from '@/lib/api/assets'
import type { EnrichedPosition, Posicion } from '@/lib/types'

describe('portfolio contributions', () => {
  it('uses deposits minus withdrawals instead of stock purchase cost', () => {
    const result = calculateNetContributions([
      { tipo_operacion: 'Compra', notas: externalFlowNote(1_000, 'Aportación') },
      { tipo_operacion: 'Venta', notas: externalFlowNote(125.5, 'Retirada') },
      { tipo_operacion: 'Compra', notas: '[REVOLUT_CASH] Venta de acciones' },
    ])

    expect(result).toBe(874.5)
  })

  it('falls back when no external funding movements have been imported', () => {
    expect(calculateNetContributions([
      { tipo_operacion: 'Compra', notas: '[REVOLUT_CASH] Compra de acciones' },
    ])).toBeNull()
  })

  it('uses net contributions for total historical return while retaining FIFO cost per position', () => {
    const positions = [
      { valor_actual: 110, coste_total_eur: 130, unidades: 1, tipo: 'Acción' },
    ] as EnrichedPosition[]

    expect(computePortfolioTotals(positions, 90)).toMatchObject({
      totalValue: 110,
      totalCost: 90,
      totalPnl: 20,
      totalPnlPercent: 22.22222222222222,
    })
  })

  it('includes unspent foreign cash in the current portfolio value', () => {
    const cashPosition = {
      activo_id: 'cash-usd',
      ticker: 'CASH-USD',
      isin: null,
      nombre: 'Efectivo USD',
      tipo: 'Fondo Monetario',
      estrategia: 'Core',
      moneda: 'USD',
      sector: 'Liquidez',
      geografia: 'Global',
      unidades: 0.26,
      coste_total: 0.26,
      comisiones_total: 0,
      num_operaciones: 1,
      ultima_operacion: '2026-07-17',
      notas: null,
    } satisfies Posicion

    const [cash] = enrichPositions([cashPosition], { prices: {}, fxRates: { USD: 1.14 } })
    expect(cash.tipo).toBe('Liquidez')
    expect(cash.valor_actual).toBeCloseTo(0.26 / 1.14, 8)
    expect(cash.precio_actual_nativo).toBe(1)
  })
})
