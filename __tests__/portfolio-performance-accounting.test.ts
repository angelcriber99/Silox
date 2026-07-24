import { describe, expect, it } from 'vitest'

import { enrichPositions, computePortfolioTotals } from '@/lib/api/assets'
import { applyPortfolioAccounting, calculatePortfolioAccounting } from '@/lib/domain/portfolio/accounting-engine'
import { applyHistoricalFxRates, missingHistoricalFxRequests } from '@/lib/domain/portfolio/historical-fx-hydration'
import type { Posicion } from '@/lib/types'

const asset = { ticker: 'USD-LOT', tipo: 'Acción', moneda: 'USD' }

const position: Posicion = {
  activo_id: 'usd-lot', ticker: 'USD-LOT', isin: null, nombre: 'USD lots',
  tipo: 'Acción', estrategia: 'Core', moneda: 'USD', sector: 'Test', geografia: 'USA',
  unidades: 10, coste_total: 0, comisiones_total: 0, num_operaciones: 2,
  ultima_operacion: '2026-07-24', notas: null,
}

describe('portfolio performance accounting', () => {
  it('uses every lot\'s purchase price and historical FX for total and daily P&L', () => {
    const ledger = [
      {
        id: 'first-buy', activo_id: 'usd-lot', activo: asset, tipo_operacion: 'Compra',
        cantidad: 5, precio_unitario: 100, comision: 5, fecha: '2026-01-10',
        created_at: '2026-01-10T12:00:00.000Z', estado: 'Completada', tipo_cambio_eur: null,
      },
      {
        id: 'today-buy', activo_id: 'usd-lot', activo: asset, tipo_operacion: 'Compra',
        cantidad: 5, precio_unitario: 150, comision: 5, fecha: '2026-07-24',
        created_at: '2026-07-24T12:00:00.000Z', estado: 'Completada', tipo_cambio_eur: null,
      },
    ]

    expect(missingHistoricalFxRequests(ledger)).toEqual([
      { currency: 'USD', date: '2026-01-10' },
      { currency: 'USD', date: '2026-07-24' },
    ])

    const hydrated = applyHistoricalFxRates(ledger, {
      'USD:2026-01-10': 1.25,
      'USD:2026-07-24': 1.2,
    })
    const accounting = calculatePortfolioAccounting(hydrated, '2026-07-24')
    const projected = applyPortfolioAccounting([position], accounting).positions
    const [enriched] = enrichPositions(projected, {
      prices: {
        'USD-LOT': {
          price: 128,
          originalPrice: 160,
          originalCurrency: 'USD',
          sparkline: [],
          dailyChangePercent24h: (160 / 140 - 1) * 100,
        },
      },
      fxRates: { EUR: 1, USD: 1.25 },
      fxPreviousRates: { EUR: 1, USD: 1.2 },
    })

    // FIFO cost: (5 × $101) / 1.25 + (5 × $151) / 1.20.
    expect(enriched.displayCost.amount).toBeCloseTo(1_033.1666666667)
    expect(enriched.displayValue?.amount).toBeCloseTo(1_280)
    expect(enriched.displayPnl?.amount).toBeCloseTo(246.8333333333)

    // Only the five earlier units existed at the previous close. The new lot
    // starts from its execution value, including its commission and FX rate.
    expect(enriched.displayDailyPnL?.amount).toBeCloseTo(67.5)
    expect(enriched.displayDailyBaseline?.amount).toBeCloseTo(1_212.5)

    const totals = computePortfolioTotals([enriched])
    expect(totals.pnlMoney.amount).toBeCloseTo(246.8333333333)
    expect(totals.pnl24hMoney.amount).toBeCloseTo(67.5)
  })

  it('hydrates reward lots even though they are not cash contributions', () => {
    const reward = {
      id: 'reward', activo_id: 'usd-lot', activo: asset, tipo_operacion: 'Compra',
      cantidad: 1, precio_unitario: 200, comision: 0, fecha: '2026-06-01',
      created_at: '2026-06-01T12:00:00.000Z', estado: 'Completada', tipo_cambio_eur: null,
      notas: '[REVOLUT_REWARD] Recompensa de staking',
    }

    expect(missingHistoricalFxRequests([reward])).toEqual([{ currency: 'USD', date: '2026-06-01' }])
    expect(applyHistoricalFxRates([reward], { 'USD:2026-06-01': 1.25 })[0].tipo_cambio_eur).toBe(1.25)
  })
})
