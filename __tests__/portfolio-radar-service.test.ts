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
    search.mockImplementation(async (query: string) => {
      if (query === 'AST SpaceMobile announces') return { news: [{
          uuid: 'asts-launch-news',
          title: 'AST SpaceMobile Announces BlueBird Orbital Launch in the First Half of August',
          publisher: 'Business Wire',
          link: 'https://example.com/asts-launch',
          providerPublishTime: new Date('2026-06-25T10:00:00.000Z'),
          relatedTickers: ['ASTS'],
        }] }
      if (query === 'NVO') return { news: [{
        uuid: 'nvo-news',
        title: 'Novo Nordisk expands its manufacturing capacity',
        publisher: 'Reuters',
        link: 'https://example.com/nvo-news',
        providerPublishTime: new Date('2026-07-17T10:00:00.000Z'),
        relatedTickers: ['NVO'],
      }] }
      if (query === 'MSCI') return { news: [{
        uuid: 'msci-news',
        title: 'MSCI World Index Fund weekly market update',
        publisher: 'Market Data',
        link: 'https://example.com/msci-news',
        providerPublishTime: new Date('2026-07-16T10:00:00.000Z'),
        relatedTickers: ['MSCI'],
      }] }
      return { news: [] }
    })
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
            { activo_id: 'nvo-id', ticker: 'NVO', nombre: 'Novo Nordisk A/S ADR', tipo: 'Acción', moneda: 'USD', unidades: 4 },
            { activo_id: 'msci-id', ticker: 'MSCI', nombre: 'MSCI World Index Fund', tipo: 'Fondo Indexado', moneda: 'EUR', unidades: 20 },
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

    expect(radar.assets.map((asset) => asset.ticker)).toEqual(['ASTS', 'NVO', 'MSCI'])
    expect(quoteSummary).toHaveBeenCalledTimes(3)
    expect(quoteSummary).toHaveBeenCalledWith('ASTS', { modules: ['calendarEvents'] })
    const searchOptions = { newsCount: 20, lang: 'es-ES', region: 'ES' }
    expect(search).toHaveBeenCalledWith('ASTS', searchOptions)
    expect(search).toHaveBeenCalledWith('AST SpaceMobile announces', searchOptions)
    expect(search).toHaveBeenCalledWith('NVO', searchOptions)
    expect(search).toHaveBeenCalledWith('Novo Nordisk A/S announces', searchOptions)
    expect(search).toHaveBeenCalledWith('MSCI', searchOptions)
    expect(search).toHaveBeenCalledWith('MSCI World Index Fund announces', searchOptions)
    expect(new Set(radar.news.map((item) => item.ticker))).toEqual(new Set(['ASTS', 'NVO', 'MSCI']))
    expect(radar.events.map((event) => event.type)).toEqual(expect.arrayContaining(['EARNINGS', 'CATALYST', 'MANUAL']))
    expect(radar.events.find((event) => event.type === 'CATALYST')).toMatchObject({
      date: '2026-08-01T12:00:00.000Z',
      endDate: '2026-08-15T12:00:00.000Z',
      certainty: 'scheduled',
      sourceUrl: 'https://example.com/asts-launch',
    })
  })
})
