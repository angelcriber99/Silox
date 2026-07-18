import { beforeEach, describe, expect, it, vi } from 'vitest'

const { quoteSummary, search } = vi.hoisted(() => ({
  quoteSummary: vi.fn(),
  search: vi.fn(),
}))

vi.mock('@/lib/server/yahoo-finance', () => ({
  getYahooFinance: () => ({ quoteSummary, search }),
}))

import { buildPortfolioRadar } from '@/lib/server/portfolio-radar'

describe('portfolio radar service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quoteSummary.mockResolvedValue({
      calendarEvents: {
        earnings: { earningsDate: [new Date('2026-08-12T12:00:00.000Z')] },
      },
    })
    search.mockImplementation(async (query: string) => ({
      news: query === 'ASTS' ? [] : [{
          uuid: 'asts-launch-news',
          title: 'AST SpaceMobile Announces BlueBird Orbital Launch in the First Half of August',
          publisher: 'Business Wire',
          link: 'https://example.com/asts-launch',
          providerPublishTime: new Date('2026-06-25T10:00:00.000Z'),
          relatedTickers: ['ASTS'],
        }],
    }))
  })

  it('derives tickers from open positions and excludes cash-like assets', async () => {
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)

      if (table === 'posiciones') {
        chain.gt = vi.fn(async () => ({
          data: [
            { activo_id: 'asts-id', ticker: 'ASTS', nombre: 'AST SpaceMobile', tipo: 'Acción', moneda: 'USD', unidades: 12 },
            { activo_id: 'cash-id', ticker: 'CASH', nombre: 'Efectivo', tipo: 'Liquidez', moneda: 'EUR', unidades: 800 },
          ],
          error: null,
        }))
      } else {
        chain.in = vi.fn(async () => ({
          data: [{ id: 'manual-1', activo_id: 'asts-id', titulo: 'Revisar tesis', dia_del_mes: 25, tipo: 'Seguimiento' }],
          error: null,
        }))
      }
      return chain
    })

    const context = {
      user: { id: 'user-1' },
      supabase: { from },
    } as unknown as Parameters<typeof buildPortfolioRadar>[0]

    const radar = await buildPortfolioRadar(context, new Date('2026-07-18T12:00:00.000Z'))

    expect(radar.assets.map((asset) => asset.ticker)).toEqual(['ASTS'])
    expect(quoteSummary).toHaveBeenCalledTimes(1)
    expect(quoteSummary).toHaveBeenCalledWith('ASTS', { modules: ['calendarEvents'] })
    expect(search).toHaveBeenCalledWith('ASTS', { newsCount: 15 })
    expect(search).toHaveBeenCalledWith('AST SpaceMobile announces', { newsCount: 20 })
    expect(radar.events.map((event) => event.type)).toEqual(expect.arrayContaining(['EARNINGS', 'CATALYST', 'MANUAL']))
    expect(radar.events.find((event) => event.type === 'CATALYST')).toMatchObject({
      date: '2026-08-01T12:00:00.000Z',
      endDate: '2026-08-15T12:00:00.000Z',
      certainty: 'scheduled',
      sourceUrl: 'https://example.com/asts-launch',
    })
  })
})
