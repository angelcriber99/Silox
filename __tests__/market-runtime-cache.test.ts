import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vercel/functions', () => ({
  getCache: () => ({
    get: vi.fn().mockRejectedValue(new Error('runtime cache unavailable')),
    set: vi.fn().mockRejectedValue(new Error('runtime cache unavailable')),
  }),
}))

import { getMarketCacheValue, setMarketCacheValue } from '@/lib/cache/market-cache'

describe('market runtime cache fallback', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps market data available outside Vercel and expires it by TTL', async () => {
    vi.useFakeTimers()
    await setMarketCacheValue('portfolio:test', { value: 42 }, 5)
    expect(await getMarketCacheValue<{ value: number }>('portfolio:test')).toEqual({ value: 42 })

    await vi.advanceTimersByTimeAsync(5_001)
    expect(await getMarketCacheValue('portfolio:test')).toBeUndefined()
  })
})
