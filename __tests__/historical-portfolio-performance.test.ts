import { describe, expect, it } from 'vitest'

import { nonCashRewardNote } from '@/lib/domain/portfolio/contributions'
import { reconstructPortfolioHistory } from '@/lib/domain/portfolio/historical-performance'
import { historicalYahooTicker } from '@/lib/actions/historical-market'

const usdAsset = { ticker: 'AAPL', tipo: 'Acción', moneda: 'USD' }
const cashUsdAsset = { ticker: 'CASH-USD', tipo: 'Liquidez', moneda: 'USD' }

describe('historical portfolio performance', () => {
  it('values every day with that day market close and FX, while keeping funding at the transaction-date FX', () => {
    const result = reconstructPortfolioHistory([
      {
        id: 'cash-in', activo_id: 'cash-usd', fecha: '2024-01-02', created_at: '2024-01-02T00:00:00.000Z', tipo_operacion: 'Compra', cantidad: 100, precio_unitario: 1, comision: 0, activo: cashUsdAsset,
      },
      {
        id: 'buy-aapl', activo_id: 'aapl', fecha: '2024-01-02', created_at: '2024-01-02T00:01:00.000Z', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 100, comision: 0, activo: usdAsset,
      },
      {
        id: 'cash-out', activo_id: 'cash-usd', fecha: '2024-01-02', created_at: '2024-01-02T00:02:00.000Z', tipo_operacion: 'Venta', cantidad: 100, precio_unitario: 1, comision: 0, activo: cashUsdAsset,
      },
      {
        id: 'dividend-cash', activo_id: 'cash-usd', fecha: '2024-01-03', tipo_operacion: 'Compra', cantidad: 5, precio_unitario: 1, comision: 0, activo: cashUsdAsset,
      },
    ], {
      aapl: { currency: 'USD', quotes: [{ date: '2024-01-02', close: 100 }, { date: '2024-01-03', close: 120 }] },
    }, {
      USD: [{ date: '2024-01-02', close: 1.2 }, { date: '2024-01-03', close: 1.5 }],
    }, {
      'USD:2024-01-02': 1.2,
    }, '2024-01-03')

    expect(result.points).toEqual([
      { date: '2024-01-02', value: 83.33333333333334, invested: 83.33333333333334 },
      { date: '2024-01-03', value: 80, invested: 83.33333333333334 },
    ])
  })

  it('keeps the portfolio line when imported cash bookkeeping is negative', () => {
    const result = reconstructPortfolioHistory([
      {
        id: 'cash-overdraft', activo_id: 'cash-usd', fecha: '2024-01-02', tipo_operacion: 'Venta', cantidad: 100,
        precio_unitario: 1, comision: 0, activo: cashUsdAsset,
      },
      {
        id: 'buy-aapl', activo_id: 'aapl', fecha: '2024-01-02', tipo_operacion: 'Compra', cantidad: 1,
        precio_unitario: 100, comision: 0, activo: usdAsset,
      },
    ], {
      aapl: { currency: 'USD', quotes: [{ date: '2024-01-02', close: 100 }] },
    }, {
      USD: [{ date: '2024-01-02', close: 1.2 }],
    }, {
      'USD:2024-01-02': 1.2,
    }, '2024-01-02')

    expect(result.points).toEqual([
      { date: '2024-01-02', value: 83.33333333333334, invested: 83.33333333333334 },
    ])
  })

  it('uses Yahoo crypto pairs for legacy symbols without a quote suffix', () => {
    expect(historicalYahooTicker({ id: 'btc', ticker: 'btc', type: 'Crypto', currency: 'USD' })).toBe('BTC-USD')
    expect(historicalYahooTicker({ id: 'eth', ticker: 'ETH-USD', type: 'Crypto', currency: 'USD' })).toBe('ETH-USD')
  })

  it('adds rewarded units to the portfolio without treating them as contributed capital', () => {
    const result = reconstructPortfolioHistory([
      {
        id: 'reward', activo_id: 'aapl', fecha: '2024-02-01', tipo_operacion: 'Compra', cantidad: 2, precio_unitario: 0, comision: 0, notas: nonCashRewardNote('Staking'), activo: usdAsset,
      },
    ], {
      aapl: { currency: 'USD', quotes: [{ date: '2024-02-01', close: 50 }] },
    }, {
      USD: [{ date: '2024-02-01', close: 1.25 }],
    }, {}, '2024-02-01')

    expect(result.points).toEqual([
      { date: '2024-02-01', value: 80, invested: 0 },
    ])
  })

  it('does not fabricate a portfolio value when an active asset lacks a real historical close', () => {
    const result = reconstructPortfolioHistory([
      {
        id: 'buy', activo_id: 'aapl', fecha: '2024-03-01', tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 100, comision: 0, activo: usdAsset,
      },
    ], {}, {
      USD: [{ date: '2024-03-01', close: 1.1 }],
    }, { 'USD:2024-03-01': 1.1 }, '2024-03-01')

    expect(result.points).toEqual([
      { date: '2024-03-01', value: null, invested: 90.9090909090909 },
    ])
  })
})
