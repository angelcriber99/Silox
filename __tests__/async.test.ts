import { describe, expect, it } from 'vitest'
import { mapSettledWithConcurrency } from '@/lib/utils/async'

describe('mapSettledWithConcurrency', () => {
  it('preserves input order and captures mapper failures', async () => {
    const results = await mapSettledWithConcurrency([3, 1, 2], 2, async (value) => {
      if (value === 1) throw new Error('failed')
      return value * 2
    })

    expect(results[0]).toEqual({ status: 'fulfilled', value: 6 })
    expect(results[1].status).toBe('rejected')
    expect(results[2]).toEqual({ status: 'fulfilled', value: 4 })
  })

  it('never exceeds the configured concurrency', async () => {
    let active = 0
    let peak = 0

    await mapSettledWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
    })

    expect(peak).toBe(2)
  })

  it('rejects invalid concurrency values', async () => {
    await expect(
      mapSettledWithConcurrency([1], 0, async (value) => value),
    ).rejects.toThrow('Concurrency must be a positive integer')
  })
})
