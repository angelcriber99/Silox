import { describe, expect, it } from 'vitest'
import {
  calculateMarketPerformance,
  getMarketDateKey,
  isQuoteFromCurrentMarketDate,
} from '@/lib/utils/market-performance'
import { aggregateDailyPnl } from '@/lib/utils/performance-history'
import { computePortfolioTotals, enrichPositions } from '@/lib/api/assets'
import type { Posicion } from '@/lib/types'

describe('market session performance', () => {
  it('resets PRE percentage against the previous post close while retaining daily movement', () => {
    const result = calculateMarketPerformance({
      regularMarketPrice: 100,
      postMarketPrice: 102,
      postMarketTime: '2026-07-10T23:59:00.000Z',
      preMarketPrice: 103,
      preMarketTime: '2026-07-13T08:00:00.000Z',
    }, 'PRE')

    expect(result.sessionChangePercent).toBeCloseTo((1 / 102) * 100)
    expect(result.dailyChangePercent).toBeCloseTo(3)
  })

  it('resets POST percentage against the regular close while retaining the full day', () => {
    const result = calculateMarketPerformance({
      regularMarketPreviousClose: 100,
      regularMarketPrice: 110,
      postMarketPrice: 111,
    }, 'POST')

    expect(result.sessionChangePercent).toBeCloseTo((1 / 110) * 100)
    expect(result.dailyChangePercent).toBeCloseTo(11)
  })

  it('keeps the last session percentage and the daily result while closed', () => {
    const result = calculateMarketPerformance({
      regularMarketPreviousClose: 100,
      regularMarketPrice: 110,
      postMarketPrice: 111,
    }, 'CLOSED')

    expect(result.sessionChangePercent).toBeCloseTo((1 / 110) * 100)
    expect(result.dailyChangePercent).toBeCloseTo(11)
  })

  it('compares quote dates in the exchange timezone', () => {
    const latePostMarket = '2026-07-13T01:30:00.000Z'

    expect(getMarketDateKey(latePostMarket)).toBe('2026-07-12')
    expect(isQuoteFromCurrentMarketDate(
      latePostMarket,
      new Date('2026-07-13T02:00:00.000Z'),
    )).toBe(true)
  })
})

describe('daily PnL aggregation', () => {
  it('combines PRE, REGULAR and POST snapshots into one US market day', () => {
    const points = [
      { timestamp: '2026-07-12T12:00:00.000Z', value: 1002, totalInvested: 1000, pnl: 2, totalPnl: 2, isFirstPoint: true },
      { timestamp: '2026-07-13T01:30:00.000Z', value: 1005, totalInvested: 1000, pnl: 3, totalPnl: 5, isFirstPoint: false },
      { timestamp: '2026-07-13T09:00:00.000Z', value: 1004, totalInvested: 1000, pnl: -1, totalPnl: 4, isFirstPoint: false },
    ]

    const daily = aggregateDailyPnl(points)

    expect(daily).toHaveLength(2)
    expect(daily[0].timestamp).toContain('2026-07-12')
    expect(daily[0].pnl).toBe(5)
    expect(daily[1].timestamp).toContain('2026-07-13')
    expect(daily[1].pnl).toBe(-1)
  })
})

describe('portfolio daily amount and session percentage', () => {
  it('calculates the amount from the full day and the percentage from the active session', () => {
    const position: Posicion = {
      activo_id: 'asset-1',
      ticker: 'ABC',
      isin: null,
      nombre: 'ABC Corp',
      tipo: 'Acción',
      estrategia: 'Core',
      moneda: 'EUR',
      sector: 'Tecnología',
      geografia: 'USA',
      unidades: 1,
      coste_total: 90,
      comisiones_total: 0,
      num_operaciones: 1,
      ultima_operacion: null,
      notas: null,
    }

    const [enriched] = enrichPositions([position], {
      prices: {
        ABC: {
          price: 110,
          originalPrice: 110,
          originalCurrency: 'EUR',
          sparkline: [],
          changePercent24h: 1,
          dailyChangePercent24h: 10,
        },
      },
    })
    const totals = computePortfolioTotals([enriched])

    expect(enriched.change_amount_24h).toBeCloseTo(10)
    expect(totals.totalPnl24h).toBeCloseTo(10)
    expect(totals.totalPnlPercent24h).toBeCloseTo(1)
  })
})
