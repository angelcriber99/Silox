"use server"

import { unstable_cache } from 'next/cache'

import YahooFinance from 'yahoo-finance2'
import {
  convertSeriesToEur,
  convertToEur,
  FX_PAIRS,
  normalizeYahooCurrency,
  type FxRatesToEur,
} from '@/lib/utils/currency'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

interface YahooQuote {
  regularMarketPrice?: number
  regularMarketChangePercent?: number
  currency?: string
  preMarketPrice?: number
  postMarketPrice?: number
  regularMarketPreviousClose?: number
  regularMarketTime?: string | Date
  preMarketTime?: string | Date
  postMarketTime?: string | Date
  exchangeTimezoneName?: string
}

async function fetchFxRatesToEur(): Promise<FxRatesToEur> {
  const pairs = Object.values(FX_PAIRS)
  const results = await Promise.allSettled(
    pairs.map((pair) => yahooFinance.quote(pair) as Promise<YahooQuote>)
  )

  const rates: FxRatesToEur = { EUR: 1 }

  pairs.forEach((pair, index) => {
    const result = results[index]
    if (result.status !== 'fulfilled') return

    const raw = result.value.regularMarketPrice
    if (!raw || raw <= 0) return

    const foreign = pair.replace('EUR', '').replace('=X', '')
    rates[foreign] = raw
  })

  return rates
}

export interface PriceEntry {
  price: number | null
  sparkline: number[]
  currency: string
  changePercent24h?: number | null
  originalPrice?: number | null
  originalCurrency?: string
}

export interface MarketPricesResult {
  prices: Record<string, PriceEntry>
  fxRates?: FxRatesToEur
  displayCurrency: string
}

async function _fetchMarketPrices(
  tickers: string[],
  convertToEurFlag: boolean = false
): Promise<MarketPricesResult> {
  if (!tickers || tickers.length === 0) {
    throw new Error('No tickers provided')
  }

  const d = new Date()
  d.setDate(d.getDate() - 7)

  const fxRates = convertToEurFlag ? await fetchFxRatesToEur() : undefined

  const results = await Promise.allSettled(
    tickers.map(async (ticker: string) => {
      const [quote, chart] = await Promise.all([
        yahooFinance.quote(ticker) as Promise<YahooQuote>,
        yahooFinance.chart(ticker, { period1: d, interval: '1d' }).catch(() => null),
      ])

      const originalCurrency = normalizeYahooCurrency(quote.currency)
      let rawPrice = quote.regularMarketPrice ?? null
      let changePercent24h = quote.regularMarketChangePercent ?? null

      if (quote.preMarketPrice && quote.regularMarketPreviousClose) {
        rawPrice = quote.preMarketPrice
        changePercent24h = ((rawPrice - quote.regularMarketPreviousClose) / quote.regularMarketPreviousClose) * 100
      } else if (quote.postMarketPrice && quote.regularMarketPreviousClose) {
        rawPrice = quote.postMarketPrice
        changePercent24h = ((rawPrice - quote.regularMarketPreviousClose) / quote.regularMarketPreviousClose) * 100
      }

      let sparkline: number[] = []
      if (chart?.quotes) {
        sparkline = chart.quotes
          .map((q) => q.close)
          .filter((c): c is number => c !== null && c !== undefined)
      }

      let price = rawPrice
      let currency = originalCurrency

      if (convertToEurFlag && fxRates && rawPrice !== null) {
        price = convertToEur(rawPrice, originalCurrency, fxRates)
        sparkline = convertSeriesToEur(sparkline, originalCurrency, fxRates)
        currency = 'EUR'
      }

      return {
        ticker,
        price,
        sparkline,
        currency,
        changePercent24h,
        originalPrice: rawPrice,
        originalCurrency,
      }
    })
  )

  const prices: Record<string, PriceEntry> = {}

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const ticker = tickers[i]

    if (result.status === 'fulfilled') {
      const { price, sparkline, currency, changePercent24h, originalPrice, originalCurrency } = result.value
      prices[ticker] = {
        price,
        sparkline,
        currency,
        changePercent24h,
        originalPrice,
        originalCurrency,
      }
    } else if (ticker) {
      prices[ticker] = { price: null, sparkline: [], currency: 'EUR', changePercent24h: null }
    }
  }

  return {
    prices,
    fxRates,
    displayCurrency: convertToEurFlag ? 'EUR' : 'native',
  }
}

export async function fetchMarketPrices(
  tickers: string[],
  convertToEurFlag: boolean = false
): Promise<MarketPricesResult> {
  if (!tickers || tickers.length === 0) {
    throw new Error('No tickers provided')
  }

  // Create a unique cache key based on the requested tickers
  const sortedTickers = [...tickers].sort()
  const cacheKey = `market-prices-${sortedTickers.join('-')}-${convertToEurFlag}`
  
  // Cache for 5 minutes (300 seconds)
  const getCachedPrices = unstable_cache(
    async () => {
      return _fetchMarketPrices(sortedTickers, convertToEurFlag)
    },
    [cacheKey],
    { revalidate: 300, tags: ['market-prices'] }
  )

  return getCachedPrices()
}

