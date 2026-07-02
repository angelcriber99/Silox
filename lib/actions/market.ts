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
  marketState?: string
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
  marketState?: string
}

export interface MarketPricesResult {
  prices: Record<string, PriceEntry>
  fxRates?: FxRatesToEur
  displayCurrency: string
  marketState: string
}

function getUSMarketState(): 'REGULAR' | 'PRE' | 'POST' | 'CLOSED' {
  const now = new Date()
  const options = { timeZone: 'America/New_York', hour12: false }
  
  const nyDateString = now.toLocaleString('en-US', options)
  const nyDate = new Date(nyDateString)
  
  const day = nyDate.getDay() // 0 = Sunday, 1 = Monday...
  if (day === 0 || day === 6) return 'CLOSED'

  const hours = nyDate.getHours()
  const minutes = nyDate.getMinutes()
  
  const time = hours * 100 + minutes // e.g. 9:30 AM -> 930
  
  if (time < 400) return 'CLOSED'
  if (time >= 400 && time < 930) return 'PRE'
  if (time >= 930 && time < 1600) return 'REGULAR'
  if (time >= 1600 && time < 2000) return 'POST'
  return 'CLOSED'
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
      if (ticker === 'CASH') {
        return {
          ticker,
          price: 1.0,
          sparkline: [1, 1, 1, 1, 1, 1, 1],
          currency: 'EUR',
          changePercent24h: 0,
          originalPrice: 1.0,
          originalCurrency: 'EUR',
          marketState: 'OPEN'
        }
      }

      const [quote, chart] = await Promise.all([
        yahooFinance.quote(ticker) as Promise<YahooQuote>,
        yahooFinance.chart(ticker, { period1: d, interval: '1d' }).catch(() => null),
      ])

      const originalCurrency = normalizeYahooCurrency(quote.currency)
      let rawPrice = quote.regularMarketPrice ?? null
      let changePercent24h = quote.regularMarketChangePercent ?? null
      
      const usMarketState = getUSMarketState() // Force US Market hours for global UI
      const assetState = quote.marketState || usMarketState // Use native state for the asset logic

      if (assetState === 'PRE' || assetState === 'PREPRE') {
        if (quote.preMarketPrice && quote.regularMarketPreviousClose) {
          rawPrice = quote.preMarketPrice
          changePercent24h = ((rawPrice - quote.regularMarketPreviousClose) / quote.regularMarketPreviousClose) * 100
        } else {
          changePercent24h = 0
        }
      } else if (assetState === 'POST' || assetState === 'POSTPOST') {
        if (quote.postMarketPrice && quote.regularMarketPreviousClose) {
          rawPrice = quote.postMarketPrice
          changePercent24h = ((rawPrice - quote.regularMarketPreviousClose) / quote.regularMarketPreviousClose) * 100
        }
      } else if (assetState === 'CLOSED') {
        changePercent24h = 0
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
        marketState: usMarketState
      }
    })
  )

  const prices: Record<string, PriceEntry> = {}
  let globalMarketState = 'CLOSED'
  let hasOpenMarket = false

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const ticker = tickers[i]

    if (result.status === 'fulfilled') {
      const { price, sparkline, currency, changePercent24h, originalPrice, originalCurrency, marketState } = result.value
      prices[ticker] = {
        price,
        sparkline,
        currency,
        changePercent24h,
        originalPrice,
        originalCurrency,
        marketState
      }
      
      if (marketState === 'REGULAR') {
        hasOpenMarket = true
        globalMarketState = 'REGULAR'
      } else if (marketState === 'PRE' && globalMarketState !== 'REGULAR') {
        globalMarketState = 'PRE'
      } else if (marketState === 'POST' && globalMarketState === 'CLOSED') {
        globalMarketState = 'POST'
      }
    } else if (ticker) {
      prices[ticker] = { price: null, sparkline: [], currency: 'EUR', changePercent24h: null }
    }
  }

  return {
    prices,
    fxRates,
    displayCurrency: convertToEurFlag ? 'EUR' : 'native',
    marketState: globalMarketState,
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

export async function fetchAssetDetails(ticker: string) {
  if (!ticker || ticker === 'CASH') return null

  try {
    const summary: any = await yahooFinance.quoteSummary(ticker, {
      modules: [
        'financialData',
        'defaultKeyStatistics',
        'summaryDetail',
        'recommendationTrend'
      ]
    })
    
    const fd = summary.financialData || {}
    const ks = summary.defaultKeyStatistics || {}
    const sd = summary.summaryDetail || {}
    const rt = summary.recommendationTrend?.trend?.[0] || {}

    return {
      currentPrice: fd.currentPrice,
      targetMeanPrice: fd.targetMeanPrice,
      recommendationKey: fd.recommendationKey,
      analystStrongBuy: rt.strongBuy,
      analystBuy: rt.buy,
      analystHold: rt.hold,
      analystSell: rt.sell,
      analystStrongSell: rt.strongSell,
      forwardPE: ks.forwardPE,
      trailingPE: sd.trailingPE,
      dividendYield: sd.dividendYield,
      profitMargins: fd.profitMargins,
      returnOnEquity: fd.returnOnEquity,
      fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: sd.fiftyTwoWeekLow,
      twoHundredDayAverage: sd.twoHundredDayAverage,
      marketCap: sd.marketCap,
      volume: sd.volume
    }
  } catch (error) {
    console.error(`Error fetching asset details for ${ticker}:`, error)
    return null
  }
}

