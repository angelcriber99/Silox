import { describe, expect, it } from 'vitest'

import { collectAllPages } from '@/lib/utils/pagination'

describe('explicit PostgREST pagination', () => {
  it('loads beyond the default one-thousand-row response cap', async () => {
    const source = Array.from({ length: 2_345 }, (_, index) => index)
    const rows = await collectAllPages(async (from, to) => ({
      data: source.slice(from, to + 1),
      error: null,
    }))

    expect(rows).toHaveLength(2_345)
    expect(rows.at(-1)).toBe(2_344)
  })

  it('fails closed when any page cannot be read', async () => {
    await expect(collectAllPages(async (from) => ({
      data: from === 0 ? Array.from({ length: 1_000 }, () => 1) : null,
      error: from === 0 ? null : { message: 'page failed' },
    }))).rejects.toThrow('page failed')
  })
})
