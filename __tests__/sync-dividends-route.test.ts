import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getYahooFinance: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/server/yahoo-finance', () => ({ getYahooFinance: mocks.getYahooFinance }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }))

import { GET } from '@/app/api/cron/sync-dividends/route'

describe('GET /api/cron/sync-dividends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('rejects an unauthenticated request before opening privileged dependencies', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    const response = await GET(new Request('http://localhost/api/cron/sync-dividends'))

    expect(response.status).toBe(401)
    expect(mocks.getYahooFinance).not.toHaveBeenCalled()
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('fails closed when the cron secret is missing', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const response = await GET(new Request('http://localhost/api/cron/sync-dividends'))

    expect(response.status).toBe(500)
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('preserves legitimate cron access with the configured bearer secret', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null })
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ select })) })
    mocks.getYahooFinance.mockReturnValue({})

    vi.stubEnv('CRON_SECRET', 'cron-secret')
    const response = await GET(new Request('http://localhost/api/cron/sync-dividends', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'No assets found' })
    expect(mocks.getSupabaseAdmin).toHaveBeenCalledOnce()
  })
})
