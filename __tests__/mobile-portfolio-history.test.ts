import { describe, expect, it } from 'vitest'

import {
  buildMobilePortfolioHistory,
  buildTransactionInvestmentHistory,
} from '@/lib/mobile/portfolio-history'

const asset = (currency: string) => ({ ticker: currency === 'EUR' ? 'ETF' : 'AAPL', tipo: 'Acción', moneda: currency })

describe('mobile portfolio history', () => {
  it('fills dates before the first valuation from imported transactions without inventing values', () => {
    const points = buildMobilePortfolioHistory(
      [{ timestamp: '2024-01-04T12:00:00.000Z', total_value: 230, total_invested: 200 }],
      [],
      [
        { id: 'buy-eur', fecha: '2024-01-02', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 100, comision: 0, activo: asset('EUR') },
        { id: 'buy-usd', fecha: '2024-01-03', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 120, comision: 0, activo: asset('USD') },
      ],
      { 'USD:2024-01-03': 1.2 },
    )

    expect(points).toEqual([
      expect.objectContaining({ date: '2024-01-02', value: null, invested: '100', source: 'transaction' }),
      expect.objectContaining({ date: '2024-01-03', value: null, invested: '200', source: 'transaction' }),
      expect.objectContaining({ date: '2024-01-04', value: '230', invested: '200', source: 'snapshot' }),
    ])
  })

  it('uses the newer portfolio_history valuation over a legacy daily snapshot for the same date', () => {
    const points = buildMobilePortfolioHistory(
      [{ timestamp: '2024-02-01T15:00:00.000Z', total_value: 125, total_invested: 100 }],
      [{ date: '2024-02-01', total_value: 110, total_invested: 100, updated_at: '2024-02-01T08:00:00.000Z' }],
      [],
      {},
    )

    expect(points).toEqual([
      expect.objectContaining({ date: '2024-02-01', value: '125', invested: '100', source: 'snapshot' }),
    ])
  })

  it('completes a legacy valuation without capital from the imported movement ledger', () => {
    const points = buildMobilePortfolioHistory(
      [],
      [{ date: '2024-02-02', total_value: 125, total_invested: null, updated_at: '2024-02-02T20:00:00.000Z' }],
      [
        { id: 'buy', fecha: '2024-02-01', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 100, comision: 0, activo: asset('EUR') },
        { id: 'sale', fecha: '2024-02-02', tipo_operacion: 'Venta', cantidad: 0.05, precio_unitario: 100, comision: 0, activo: asset('EUR') },
      ],
      {},
    )

    expect(points).toEqual([
      expect.objectContaining({ date: '2024-02-01', value: null, invested: '100', source: 'transaction' }),
      expect.objectContaining({ date: '2024-02-02', value: '125', invested: '95', source: 'snapshot' }),
    ])
  })

  it('does not keep emitting an inaccurate EUR capital curve after an unresolved historic FX flow', () => {
    const result = buildTransactionInvestmentHistory([
      { id: 'eur', fecha: '2024-03-01', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 100, comision: 0, activo: asset('EUR') },
      { id: 'usd', fecha: '2024-03-02', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 120, comision: 0, activo: asset('USD') },
      { id: 'later', fecha: '2024-03-03', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 80, comision: 0, activo: asset('EUR') },
    ], {})

    expect(result.unresolvedFlowCount).toBe(1)
    expect(result.points).toEqual([
      expect.objectContaining({ date: '2024-03-01', invested: '100', value: null }),
    ])
  })

  it('applies the requested date range after reconstructing cumulative invested capital', () => {
    const points = buildMobilePortfolioHistory(
      [],
      [],
      [
        { id: 'first', fecha: '2023-12-20', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 100, comision: 0, activo: asset('EUR') },
        { id: 'second', fecha: '2024-01-10', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 50, comision: 0, activo: asset('EUR') },
      ],
      {},
      { from: '2024-01-01' },
    )

    expect(points).toEqual([
      expect.objectContaining({ date: '2024-01-10', invested: '150', source: 'transaction' }),
    ])
  })
})
