import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { quote, chart, quoteSummary, search, fetchMetalChartInEur } = vi.hoisted(() => ({
  quote: vi.fn(),
  chart: vi.fn(),
  quoteSummary: vi.fn(),
  search: vi.fn(),
  fetchMetalChartInEur: vi.fn(),
}))

vi.mock('@/lib/server/api-auth', () => ({
  requireApiUser: vi.fn(async () => ({ ok: true, user: { id: 'user-1' } })),
}))

vi.mock('@/lib/server/yahoo-finance', () => ({
  getYahooFinance: () => ({ quote, chart, quoteSummary, search }),
}))

vi.mock('@/lib/actions/market', () => ({
  fetchMetalChartInEur,
}))

import { GET as getTickerMarket } from '@/app/api/market/[ticker]/route'
import { POST as getMarketData } from '@/app/api/market-data/route'

describe('market API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMetalChartInEur.mockResolvedValue(null)
  })

  it('combina cotización, gráfico y resumen sin perder precios de valor cero', async () => {
    quote.mockResolvedValue({
      marketCap: 3_000_000_000,
      currency: 'USD',
      regularMarketVolume: 1_500,
    })
    chart.mockResolvedValue({
      quotes: [
        { date: new Date('2026-07-10T10:00:00Z'), close: 0, open: 12, volume: 5 },
        { date: new Date('2026-07-10T11:00:00Z'), close: null, open: null, volume: 2 },
      ],
    })
    quoteSummary.mockResolvedValue({
      summaryProfile: { sector: 'Technology' },
      financialData: { currentPrice: 200 },
    })

    const response = await getTickerMarket(
      new Request('http://localhost/api/market/AAPL?range=1mo&type=Acci%C3%B3n'),
      { params: Promise.resolve({ ticker: 'AAPL' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.quote.marketCap).toBe('3.00B')
    expect(body.chart).toEqual([{
      date: '2026-07-10T10:00:00.000Z',
      price: 0,
      volume: 5,
    }])
    expect(body.summary.profile.sector).toBe('Technology')
    expect(quote).toHaveBeenCalledOnce()
    expect(chart).toHaveBeenCalledOnce()
    expect(quoteSummary).toHaveBeenCalledOnce()
  })

  it('devuelve los datos disponibles cuando falla una fuente secundaria', async () => {
    quote.mockResolvedValue({ currency: 'EUR' })
    chart.mockRejectedValue(new Error('chart unavailable'))
    quoteSummary.mockResolvedValue(null)

    const response = await getTickerMarket(
      new Request('http://localhost/api/market/TEST?range=5d'),
      { params: Promise.resolve({ ticker: 'TEST' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.quote.currency).toBe('EUR')
    expect(body.chart).toEqual([])
    expect(body.summary).toBeNull()
    expect(quoteSummary).not.toHaveBeenCalled()
  })

  it('sirve el gráfico de metales en EUR sin consultar Yahoo', async () => {
    fetchMetalChartInEur.mockResolvedValue([
      { date: '2026-07-13T00:00:00.000Z', price: 1096.1 },
      { date: '2026-07-14T00:00:00.000Z', price: 1105.13 },
    ])

    const response = await getTickerMarket(
      new Request('http://localhost/api/market/PA%3DF?range=1mo'),
      { params: Promise.resolve({ ticker: 'PA=F' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.currency).toBe('EUR')
    expect(body.chart).toHaveLength(2)
    expect(quote).not.toHaveBeenCalled()
    expect(chart).not.toHaveBeenCalled()
  })

  it('resuelve un ISIN a ticker Yahoo y reutiliza la respuesta almacenada', async () => {
    search.mockResolvedValue({
      quotes: [
        { isYahooFinance: false, name: 'External result' },
        { isYahooFinance: true, symbol: 'ETF.DE' },
      ],
    })
    quoteSummary.mockResolvedValue({
      topHoldings: {
        sectorWeightings: [{ technology: 0.4 }, { healthcare: 0.2 }],
        holdings: [{ symbol: 'AAPL', holdingName: 'Apple', holdingPercent: 0.08 }],
      },
      fundProfile: { legalType: 'Exchange Traded Fund' },
      price: { longName: 'Test ETF' },
    })

    const makeRequest = () => new NextRequest('http://localhost/api/market-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'TEST-FUND', isin: 'IE00TEST1234' }),
    })

    const firstResponse = await getMarketData(makeRequest())
    const secondResponse = await getMarketData(makeRequest())
    const body = await firstResponse.json()

    expect(body).toMatchObject({
      symbol: 'ETF.DE',
      name: 'Test ETF',
      sectorWeightings: { technology: 0.4, healthcare: 0.2 },
      assetClass: 'Exchange Traded Fund',
    })
    expect(secondResponse.status).toBe(200)
    expect(search).toHaveBeenCalledOnce()
    expect(quoteSummary).toHaveBeenCalledOnce()
  })
})
