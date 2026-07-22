import { describe, expect, it } from 'vitest'

import {
  calculateFixedNetInvestmentEur,
  calculateNetInvestmentByCurrency,
  calculateNetContributions,
  externalFlowNote,
  nonCashRewardNote,
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
      { displayValue: { amount: 110, currency: 'EUR' }, displayCost: { amount: 130, currency: 'EUR' }, unidades: 1, tipo: 'Acción' },
    ] as EnrichedPosition[]

    expect(computePortfolioTotals(positions, 90)).toMatchObject({
      valueMoney: { amount: 110 },
      costMoney: { amount: 130 },
      pnlMoney: { amount: -20 },
      totalPnlPercent: -15.384615384615385,
    })
  })

  it('does not dilute daily return with positions that lack a daily baseline', () => {
    const positions = [
      {
        displayValue: { amount: 110, currency: 'EUR' },
        displayCost: { amount: 100, currency: 'EUR' },
        unidades: 1,
        tipo: 'Acción',
        displayDailyPnL: { amount: 10, currency: 'EUR' },
        daily_change_percent_24h: 10,
        displayDailyBaseline: { amount: 100, currency: 'EUR' },
        change_percent_24h: 1,
      },
      {
        displayValue: { amount: 100, currency: 'EUR' },
        displayCost: { amount: 100, currency: 'EUR' },
        unidades: 1,
        tipo: 'Acción',
        change_amount_24h: null,
        daily_change_percent_24h: null,
        change_percent_24h: null,
      },
    ] as EnrichedPosition[]

    const totals = computePortfolioTotals(positions)
    expect(totals).toMatchObject({
      pnl24hMoney: { amount: 10 },
      dailyPerformancePositionCount: 1,
      positionCount: 2,
    })
    expect(totals.totalDailyPnlPercent).toBeCloseTo(10)
  })

  it('rejects an invalid minus-one-hundred-percent daily baseline', () => {
    const position = {
      activo_id: 'asset',
      ticker: 'TEST',
      isin: null,
      nombre: 'Test',
      tipo: 'Acción',
      estrategia: 'Core',
      moneda: 'EUR',
      sector: 'Otros',
      geografia: 'Global',
      unidades: 1,
      coste_total: 100,
      comisiones_total: 0,
      num_operaciones: 1,
      ultima_operacion: '2026-07-18',
      notas: null,
    } satisfies Posicion

    const [enriched] = enrichPositions([position], {
      prices: {
        TEST: {
          price: 1,
          originalPrice: 1,
          sparkline: [],
          dailyChangePercent24h: -100,
        },
      },
    })

    expect((enriched.displayDailyPnL?.amount ?? null)).toBeNull()
    expect(computePortfolioTotals([enriched]).dailyPerformancePositionCount).toBe(0)
  })

  it('measures a same-day purchase from its execution price instead of the previous close', () => {
    const position = {
      activo_id: 'asset',
      ticker: 'TEST',
      isin: null,
      nombre: 'Test',
      tipo: 'Acción',
      estrategia: 'Core',
      moneda: 'EUR',
      sector: 'Otros',
      geografia: 'Global',
      unidades: 10,
      coste_total: 1_002,
      comisiones_total: 2,
      num_operaciones: 1,
      ultima_operacion: '2026-07-18',
      notas: null,
      has_daily_activity: true,
      daily_net_units: 10,
      daily_net_flow_nativo: 1_002,
    } satisfies Posicion

    const [enriched] = enrichPositions([position], {
      prices: {
        TEST: {
          price: 110,
          originalPrice: 110,
          originalCurrency: 'EUR',
          sparkline: [],
          dailyChangePercent24h: (110 / 90 - 1) * 100,
        },
      },
    })

    expect((enriched.displayDailyPnL?.amount ?? null)).toBeCloseTo(98)
    expect((enriched.displayDailyBaseline?.amount ?? null)).toBeCloseTo(1_002)
    expect(computePortfolioTotals([enriched]).totalDailyPnlPercent).toBeCloseTo((98 / 1_002) * 100)
  })

  it('retains realized daily P&L when a position is fully sold today', () => {
    const soldPosition = {
      activo_id: 'asset',
      ticker: 'TEST',
      isin: null,
      nombre: 'Test',
      tipo: 'Acción',
      estrategia: 'Core',
      moneda: 'EUR',
      sector: 'Otros',
      geografia: 'Global',
      unidades: 0,
      coste_total: 0,
      comisiones_total: 1,
      num_operaciones: 2,
      ultima_operacion: '2026-07-18',
      notas: null,
      has_daily_activity: true,
      daily_net_units: -10,
      daily_net_flow_nativo: -1_049,
    } satisfies Posicion

    const [enriched] = enrichPositions([soldPosition], {
      prices: {
        TEST: {
          price: 110,
          originalPrice: 110,
          originalCurrency: 'EUR',
          sparkline: [],
          dailyChangePercent24h: (110 / 90 - 1) * 100,
        },
      },
    })
    const totals = computePortfolioTotals([enriched])

    expect((enriched.displayDailyPnL?.amount ?? null)).toBeCloseTo(149)
    expect(totals.pnl24hMoney.amount).toBeCloseTo(149)
    expect(totals.totalDailyPnlPercent).toBeCloseTo((149 / 900) * 100)
  })

  it('subtracts sales, fees and net dividends from invested capital by currency', () => {
    const asset = { ticker: 'ASTS', tipo: 'Acción', moneda: 'USD' }
    const funding = calculateNetInvestmentByCurrency([
      { activo: asset, tipo_operacion: 'Compra', cantidad: 10, precio_unitario: 20, comision: 2 },
      { activo: asset, tipo_operacion: 'Venta', cantidad: 4, precio_unitario: 30, comision: 1 },
      { activo: asset, tipo_operacion: 'Dividendo', cantidad: 1, precio_unitario: 5, comision: 0, retencion_origen: 1, retencion_destino: 0 },
    ])

    expect(funding.netByCurrency.USD).toBe(83)
  })

  it('freezes every foreign-currency flow at its transaction-date FX rate', () => {
    const asset = { ticker: 'ASTS', tipo: 'AcciÃ³n', moneda: 'USD' }
    const funding = calculateNetInvestmentByCurrency([
      {
        id: 'buy', fecha: '2026-01-10', activo: asset,
        tipo_operacion: 'Compra', cantidad: 10, precio_unitario: 20, comision: 2,
        tipo_cambio_eur: 1.20,
      },
      {
        id: 'sell', fecha: '2026-02-10', activo: asset,
        tipo_operacion: 'Venta', cantidad: 4, precio_unitario: 30, comision: 1,
        tipo_cambio_eur: 1.25,
      },
    ])

    // 202 USD / 1.20 minus 119 USD / 1.25. Today's FX is deliberately absent:
    // once recorded, the result cannot move with the current exchange rate.
    expect(calculateFixedNetInvestmentEur(funding)).toBeCloseTo(73.1333333333)
    expect(calculateFixedNetInvestmentEur(funding, { 'USD:2026-01-10': 9 })).toBeCloseTo(73.1333333333)
  })

  it('uses historical date rates for legacy rows and never a current aggregate rate', () => {
    const asset = { ticker: 'ASTS', tipo: 'AcciÃ³n', moneda: 'USD' }
    const funding = calculateNetInvestmentByCurrency([
      { fecha: '2026-01-10', activo: asset, tipo_operacion: 'Compra', cantidad: 10, precio_unitario: 20, comision: 0 },
      { fecha: '2026-02-10', activo: asset, tipo_operacion: 'Venta', cantidad: 4, precio_unitario: 30, comision: 0 },
    ])

    expect(calculateFixedNetInvestmentEur(funding, {
      'USD:2026-01-10': 1.20,
      'USD:2026-02-10': 1.25,
    })).toBeCloseTo(70.6666666667)
  })

  it('excludes staking and free rewards from invested capital', () => {
    const asset = { ticker: 'ETH-USD', tipo: 'Crypto', moneda: 'EUR' }
    const funding = calculateNetInvestmentByCurrency([
      { activo: asset, tipo_operacion: 'Compra', cantidad: 1, precio_unitario: 1_500, comision: 0 },
      {
        activo: asset,
        tipo_operacion: 'Compra',
        cantidad: 0.1,
        precio_unitario: 1_800,
        comision: 0,
        notas: nonCashRewardNote('Recompensa de staking'),
      },
    ])

    expect(funding.netByCurrency.EUR).toBe(1_500)
  })

  it('excludes cash and money-market bookkeeping from net invested capital', () => {
    const funding = calculateNetInvestmentByCurrency([
      {
        activo: { ticker: 'CASH_USD', tipo: 'Fondo Monetario', moneda: 'USD' },
        tipo_operacion: 'Compra', cantidad: 1_000, precio_unitario: 1, comision: 0,
      },
      {
        activo: { ticker: 'REVOLUT', tipo: 'Fondo Monetario', moneda: 'EUR' },
        tipo_operacion: 'Compra', cantidad: 800, precio_unitario: 1, comision: 0,
      },
    ])

    expect(funding.netByCurrency).toEqual({})
    expect(calculateFixedNetInvestmentEur(funding, { 'USD:2026-01-10': 1.25 })).toBeNull()
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
    expect((cash.displayValue?.amount ?? null)).toBeCloseTo(0.26 / 1.14, 8)
    expect(cash.precio_actual_nativo).toBe(1)
  })
})
