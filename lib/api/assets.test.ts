import { describe, it, expect } from 'vitest'
import { enrichPositions, computePortfolioTotals } from './assets'
import type { Posicion, PriceData } from '@/lib/types'

describe('Math Calculations - enrichPositions', () => {
  it('calculates P&L and percentages perfectly for a standard EUR asset', () => {
    const position: Posicion = {
      activo_id: '1',
      user_id: 'user',
      ticker: 'SAN.MC',
      nombre: 'Banco Santander',
      tipo: 'Acción',
      moneda: 'EUR',
      unidades: 100,
      coste_total: 400, // 4€ por unidad
      comisiones_total: 5,
      num_operaciones: 2,
    }

    const priceData: Record<string, PriceData> = {
      'SAN.MC': {
        price: 5, // Sube a 5€
        sparkline: [4, 5],
        originalPrice: 5,
        originalCurrency: 'EUR',
        changePercent24h: 2.5,
      }
    }

    const enriched = enrichPositions([position], { prices: priceData })[0]

    expect(enriched.precio_actual).toBe(5)
    expect(enriched.precio_actual_nativo).toBe(5)
    expect(enriched.valor_actual).toBe(500) // 100 * 5
    expect(enriched.coste_total_eur).toBe(400)
    expect(enriched.pnl).toBe(100) // 500 - 400
    expect(enriched.pnl_percent).toBe(25) // 100 / 400 * 100
    expect(enriched.change_percent_24h).toBe(2.5)
  })

  it('calculates P&L perfectly for a USD asset converted to EUR', () => {
    const position: Posicion = {
      activo_id: '2',
      user_id: 'user',
      ticker: 'AAPL',
      nombre: 'Apple',
      tipo: 'Acción',
      moneda: 'USD',
      unidades: 10,
      coste_total: 1500, // Coste total fue de 1500 USD
      comisiones_total: 0,
      num_operaciones: 1,
    }

    const fxRates = { 'USD': 1.10 } // 1 EUR = 1.10 USD

    const priceData: Record<string, PriceData> = {
      'AAPL': {
        price: 181.81818181, // 200 USD / 1.10
        sparkline: [],
        originalPrice: 200,
        originalCurrency: 'USD',
        changePercent24h: -1.0,
      }
    }

    const enriched = enrichPositions([position], { prices: priceData, fxRates })[0]

    expect(enriched.precio_actual_nativo).toBe(200) // 200 USD
    expect(enriched.original_currency).toBe('USD')
    
    // Coste total en EUR: 1500 USD / 1.10 = 1363.6363...
    expect(enriched.coste_total_eur).toBeCloseTo(1500 / 1.10)
    
    // Valor actual en EUR: 10 unidades * (200 / 1.10)
    expect(enriched.valor_actual).toBeCloseTo(10 * (200 / 1.10))
    
    // P&L = Valor EUR - Coste EUR
    const expectedPnl = (2000 / 1.10) - (1500 / 1.10)
    expect(enriched.pnl).toBeCloseTo(expectedPnl)
    
    // P&L % = Pnl / Coste EUR
    const expectedPnlPercent = (expectedPnl / (1500 / 1.10)) * 100
    expect(enriched.pnl_percent).toBeCloseTo(expectedPnlPercent) // Debería ser +33.33%
  })

  it('handles negative P&L correctly', () => {
    const position: Posicion = {
      activo_id: '3',
      user_id: 'user',
      ticker: 'BAD',
      tipo: 'Acción',
      moneda: 'EUR',
      unidades: 50,
      coste_total: 1000, // 20€/u
      comisiones_total: 0,
      num_operaciones: 1,
    }

    const priceData: Record<string, PriceData> = {
      'BAD': { price: 10, sparkline: [], originalCurrency: 'EUR' } // Baja a 10€/u
    }

    const enriched = enrichPositions([position], { prices: priceData })[0]
    expect(enriched.valor_actual).toBe(500)
    expect(enriched.pnl).toBe(-500)
    expect(enriched.pnl_percent).toBe(-50)
  })

  it('returns correctly when no prices are available', () => {
    const position: Posicion = {
      activo_id: '4',
      user_id: 'user',
      ticker: 'UNKNOWN',
      tipo: 'Acción',
      moneda: 'EUR',
      unidades: 10,
      coste_total: 100,
      comisiones_total: 0,
      num_operaciones: 1,
    }

    const enriched = enrichPositions([position], { prices: {} })[0]
    
    // Sin precios, el fallback es precio medio (10€/u) si no es Fondo Monetario.
    // Wait, the fallback is coste_total / unidades = 100 / 10 = 10.
    expect(enriched.precio_actual).toBe(10)
    expect(enriched.valor_actual).toBe(100)
    expect(enriched.pnl).toBe(0)
    expect(enriched.pnl_percent).toBe(0)
  })
})

describe('Math Calculations - computePortfolioTotals', () => {
  it('aggregates portfolio totals correctly including 24h metrics', () => {
    const enrichedPositions = [
      {
        valor_actual: 1000,
        coste_total_eur: 800,
        change_percent_24h: 10, // Sube un 10% hoy.
        unidades: 10,
      },
      {
        valor_actual: 500,
        coste_total_eur: 600,
        change_percent_24h: -20, // Baja un 20% hoy.
        unidades: 5,
      }
    ] as any[]

    const totals = computePortfolioTotals(enrichedPositions)

    // Total Valor = 1500
    expect(totals.totalValue).toBe(1500)
    
    // Total Coste = 1400
    expect(totals.totalCost).toBe(1400)
    
    // Total P&L = 100
    expect(totals.totalPnl).toBe(100)
    
    // Total P&L % = 100 / 1400 * 100 = 7.142857...%
    expect(totals.totalPnlPercent).toBeCloseTo(7.142857, 4)

    // 24h P&L:
    // Asset 1: v = 1000, cp = 10. vAyer = 1000 / 1.10 = 909.09. pnl24 = 1000 - 909.09 = 90.909...
    // Asset 2: v = 500, cp = -20. vAyer = 500 / 0.8 = 625. pnl24 = 500 - 625 = -125.
    // Total pnl24 = 90.909... - 125 = -34.0909...
    expect(totals.totalPnl24h).toBeCloseTo(-34.0909, 4)

    // Total vAyer = 909.0909 + 625 = 1534.0909...
    // Total P&L % 24h = (-34.0909 / 1534.0909) * 100 = -2.2222...
    expect(totals.totalPnlPercent24h).toBeCloseTo(-2.22222, 4)
  })

  it('handles 0% change safely without dividing by zero', () => {
    const enrichedPositions = [
      {
        valor_actual: 1000,
        coste_total_eur: 1000,
        change_percent_24h: 0,
        unidades: 10,
      }
    ] as any[]

    const totals = computePortfolioTotals(enrichedPositions)
    expect(totals.totalPnl24h).toBe(0)
    expect(totals.totalPnlPercent24h).toBe(0)
  })
})
