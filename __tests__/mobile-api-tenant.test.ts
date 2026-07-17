import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/actions/market', () => ({ fetchMarketPricesDirect: vi.fn() }))
vi.mock('@/lib/server/yahoo-finance', () => ({ getYahooFinance: vi.fn() }))

import { createAsset, listAssets } from '@/lib/mobile/services'

function contextWith(table: Record<string, unknown>) {
  return {
    user: { id: 'tenant-a' },
    method: 'bearer' as const,
    supabase: { from: vi.fn(() => table) },
  } as never
}

describe('mobile API tenant isolation', () => {
  it('always scopes asset reads to the authenticated user', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))

    await listAssets(contextWith({ select }))

    expect(eq).toHaveBeenCalledWith('user_id', 'tenant-a')
  })

  it('derives user_id from auth and ignores client ownership fields', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'asset-1', user_id: 'tenant-a', ticker: 'AAPL', isin: null, nombre: 'Apple',
        tipo: 'Acción', estrategia: 'Core', moneda: 'USD', sector: '', geografia: '',
        notas: null, created_at: '2026-07-17', updated_at: '2026-07-17',
      },
      error: null,
    })
    const selectAfterInsert = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select: selectAfterInsert }))

    await createAsset(contextWith({ insert }), {
      ticker: 'aapl', name: 'Apple', type: 'Acción', strategy: 'Core', currency: 'usd',
      userId: 'tenant-b',
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'tenant-a' }))
    expect(insert).not.toHaveBeenCalledWith(expect.objectContaining({ user_id: 'tenant-b' }))
  })
})
