import { describe, expect, it } from 'vitest'

import {
  firstUsableMarketPrice,
  hasCompleteMarketPrices,
  hasUsableMarketPrice,
} from '@/lib/cache/market-cache-policy'

describe('market cache policy', () => {
  it('never treats a null, invalid or zero quote as last-known market data', () => {
    expect(hasUsableMarketPrice(undefined)).toBe(false)
    expect(hasUsableMarketPrice({ price: null })).toBe(false)
    expect(hasUsableMarketPrice({ price: Number.NaN })).toBe(false)
    expect(hasUsableMarketPrice({ price: 0 })).toBe(false)
    expect(hasUsableMarketPrice({ price: 64.8 })).toBe(true)
  })

  it('only serves a shared basket when every requested ticker has a quote', () => {
    expect(hasCompleteMarketPrices(['ASTS', 'NVO'], {
      ASTS: { price: 64.8 },
      NVO: { price: 49.35 },
    })).toBe(true)
    expect(hasCompleteMarketPrices(['ASTS', 'NVO'], {
      ASTS: { price: 64.8 },
      NVO: { price: null },
    })).toBe(false)
  })

  it('keeps the first valid quote instead of overwriting it with an outage', () => {
    expect(firstUsableMarketPrice(
      { price: null, source: 'failed-refresh' },
      { price: 64.8, source: 'last-known' },
    )).toEqual({ price: 64.8, source: 'last-known' })
  })
})
