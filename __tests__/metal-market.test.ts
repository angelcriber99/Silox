import { describe, expect, it } from 'vitest'

import {
  buildMetalChartPoints,
  buildMetalPriceMetrics,
  getMetalChartDateKeys,
} from '@/lib/utils/metal-market'

describe('buildMetalPriceMetrics', () => {
  it('calculates the latest EUR price, daily change, and ordered history', () => {
    const metrics = buildMetalPriceMetrics(
      'xag',
      { date: '2026-07-14', rates: { xag: 0.02 } },
      [
        { date: '2026-07-13', rates: { xag: 0.025 } },
        { date: '2026-07-12', rates: { xag: 0.04 } },
      ],
    )

    expect(metrics?.price).toBe(50)
    expect(metrics?.sparkline).toEqual([25, 40, 50])
    expect(metrics?.changePercent).toBeCloseTo(25)
  })

  it('ignores unavailable historical rates without inventing a zero change', () => {
    const metrics = buildMetalPriceMetrics(
      'xpd',
      { date: '2026-07-14', rates: { xpd: 0.001 } },
      [{ date: '2026-07-13', rates: {} }],
    )

    expect(metrics).toEqual({
      price: 1000,
      sparkline: [1000],
      changePercent: null,
    })
  })

  it('rejects an invalid latest rate instead of displaying a stale price', () => {
    expect(buildMetalPriceMetrics(
      'xau',
      { date: '2026-07-14', rates: { xau: 0 } },
      [{ date: '2026-07-13', rates: { xau: 0.0003 } }],
    )).toBeNull()
  })

  it('builds a chronological EUR chart and drops invalid rates', () => {
    expect(buildMetalChartPoints('xpd', [
      { date: '2026-07-14', rates: { xpd: 0.001 } },
      { date: '2026-07-12', rates: { xpd: 0.002 } },
      { date: '2026-07-13', rates: { xpd: 0 } },
    ])).toEqual([
      { date: '2026-07-12T00:00:00.000Z', price: 500 },
      { date: '2026-07-14T00:00:00.000Z', price: 1000 },
    ])
  })

  it('selects dense short ranges and caps long ranges to about 30 points', () => {
    expect(getMetalChartDateKeys('2026-07-14', '1d')).toEqual([
      '2026-07-13',
      '2026-07-14',
    ])
    expect(getMetalChartDateKeys('2026-07-14', '5d')).toHaveLength(6)
    expect(getMetalChartDateKeys('2026-07-14', 'max').length).toBeLessThanOrEqual(32)
  })
})
