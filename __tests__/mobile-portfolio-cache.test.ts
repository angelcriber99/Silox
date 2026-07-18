import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  portfolio: vi.fn(),
  requireMobileUser: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/mobile/auth', () => ({ requireMobileUser: mocks.requireMobileUser }))
vi.mock('@/lib/mobile/services', () => ({ portfolio: mocks.portfolio }))

import { GET } from '@/app/api/mobile/v1/portfolio/route'

function portfolioResult(asOf: string, marketState = 'REGULAR_OPEN') {
  return {
    asOf,
    displayCurrency: 'EUR',
    marketState,
    totals: { value: '100', cost: '80', profitLoss: '20', profitLossPercent: 25 },
    positions: [],
  }
}

describe('mobile portfolio private conditional cache', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a private ETag and refresh recommendation', async () => {
    mocks.portfolio.mockResolvedValue(portfolioResult('2026-07-18T10:00:00.000Z'))
    const response = await GET(new Request('http://localhost/api/mobile/v1/portfolio'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-cache')
    expect(response.headers.get('etag')).toMatch(/^W\/"[a-f0-9]{64}"$/)
    expect(response.headers.get('x-silox-refresh-after')).toBe('5')
    await expect(response.json()).resolves.toMatchObject({
      data: { asOf: '2026-07-18T10:00:00.000Z', totals: { value: '100' } },
    })
  })

  it('returns 304 when only asOf changed and keeps cache headers', async () => {
    mocks.portfolio
      .mockResolvedValueOnce(portfolioResult('2026-07-18T10:00:00.000Z'))
      .mockResolvedValueOnce(portfolioResult('2026-07-18T10:00:05.000Z'))

    const first = await GET(new Request('http://localhost/api/mobile/v1/portfolio'))
    const etag = first.headers.get('etag')!
    const second = await GET(new Request('http://localhost/api/mobile/v1/portfolio', {
      headers: { 'If-None-Match': etag },
    }))

    expect(second.status).toBe(304)
    expect(second.headers.get('etag')).toBe(etag)
    expect(second.headers.get('cache-control')).toBe('private, no-cache')
    expect(second.headers.get('x-silox-refresh-after')).toBe('5')
    expect(await second.text()).toBe('')
  })

  it('recommends a slower refresh while the market is closed', async () => {
    mocks.portfolio.mockResolvedValue(portfolioResult('2026-07-18T10:00:00.000Z', 'CLOSED'))
    const response = await GET(new Request('http://localhost/api/mobile/v1/portfolio'))
    expect(response.headers.get('x-silox-refresh-after')).toBe('30')
  })
})
