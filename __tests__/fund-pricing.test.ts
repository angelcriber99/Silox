import { describe, expect, it } from 'vitest'

import { deriveFundPricing } from '@/lib/utils/fund-pricing'

describe('fund NAV pricing', () => {
  it('keeps the latest published NAV without attributing an old NAV to today', () => {
    const result = deriveFundPricing({
      currentPrice: 11.7145,
      previousClose: 11.7435,
      asOf: '2026-07-20T20:00:00Z',
      exchangeTimezone: 'Europe/Berlin',
      now: new Date('2026-07-22T12:00:00Z'),
    })

    expect(result.currentPrice).toBe(11.7145)
    expect(result.effectiveDate).toBe('2026-07-20')
    expect(result.dailyChangePercent).toBe(0)
    expect(result.isStale).toBe(false)
  })

  it('reports the NAV movement when a new NAV is published for the current date', () => {
    const result = deriveFundPricing({
      currentPrice: 11.8,
      previousClose: 11.6,
      asOf: '2026-07-22T18:00:00Z',
      exchangeTimezone: 'Europe/Berlin',
      now: new Date('2026-07-22T20:00:00Z'),
    })

    expect(result.dailyChangePercent).toBeCloseTo((11.8 / 11.6 - 1) * 100)
  })

  it('marks a NAV stale only after the expected publication window', () => {
    const result = deriveFundPricing({
      currentPrice: 11.7,
      asOf: '2026-07-16T18:00:00Z',
      exchangeTimezone: 'Europe/Berlin',
      now: new Date('2026-07-22T12:00:00Z'),
    })

    expect(result.isStale).toBe(true)
  })
})
