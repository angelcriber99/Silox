import { describe, expect, it } from 'vitest'

import {
  aggregateDailyPnl,
  buildPerformanceSeries,
  filterPerformanceSeries,
  summarizePerformance,
  type PortfolioSnapshot,
} from '@/lib/utils/performance-history'

const snapshot = (
  timestamp: string,
  totalValue: number,
  totalInvested: number,
): PortfolioSnapshot => ({
  timestamp,
  total_value: totalValue,
  total_invested: totalInvested,
})

describe('portfolio performance history', () => {
  it('does not count a capital contribution as market profit', () => {
    const points = buildPerformanceSeries([
      snapshot('2026-07-16T10:00:00.000Z', 1_000, 1_000),
      snapshot('2026-07-16T11:00:00.000Z', 1_100, 1_000),
      snapshot('2026-07-16T12:00:00.000Z', 1_600, 1_500),
    ])

    expect(points[1].pnl).toBe(100)
    expect(points[2].netFlow).toBe(500)
    expect(points[2].pnl).toBe(0)
    expect(points[2].totalPnl).toBe(100)

    const result = summarizePerformance(points, '1D')
    expect(result.profit).toBe(100)
    expect(result.profitPercent).toBeCloseTo(10)
  })

  it('does not turn a withdrawal into a loss', () => {
    const points = buildPerformanceSeries([
      snapshot('2026-07-16T10:00:00.000Z', 1_000, 1_000),
      snapshot('2026-07-16T11:00:00.000Z', 1_200, 1_000),
      snapshot('2026-07-16T12:00:00.000Z', 600, 400),
    ])

    expect(points[2].netFlow).toBe(-600)
    expect(points[2].pnl).toBe(0)
    expect(points[2].totalPnl).toBe(200)
  })

  it('combines pre-market, regular market and post-market into one trading day', () => {
    const points = buildPerformanceSeries([
      snapshot('2026-07-15T23:55:00.000Z', 100, 100),
      snapshot('2026-07-16T12:00:00.000Z', 105, 100),
      snapshot('2026-07-16T15:00:00.000Z', 110, 100),
      snapshot('2026-07-16T21:00:00.000Z', 108, 100),
      snapshot('2026-07-17T00:00:00.000Z', 112, 100),
    ])

    const dayPoints = filterPerformanceSeries(points, '1D', new Date('2026-07-17T00:30:00.000Z'))
    const daily = aggregateDailyPnl(dayPoints)

    expect(daily).toHaveLength(1)
    expect(daily[0].pnl).toBe(12)
    expect(daily[0].pnlPercent).toBeCloseTo(12)
  })

  it('never invents a boundary point when the selected range has no history', () => {
    const points = buildPerformanceSeries([
      snapshot('2025-01-01T12:00:00.000Z', 1_100, 1_000),
    ])

    expect(filterPerformanceSeries(points, '1W', new Date('2026-07-18T12:00:00.000Z'))).toEqual([])
  })

  it('shows exact all-time profit even when only the current snapshot exists', () => {
    const points = buildPerformanceSeries([], snapshot('2026-07-18T12:00:00.000Z', 1_250, 1_000))
    const result = summarizePerformance(points, 'ALL')

    expect(points).toHaveLength(1)
    expect(result.profit).toBe(250)
    expect(result.profitPercent).toBeCloseTo(25)
  })
})
