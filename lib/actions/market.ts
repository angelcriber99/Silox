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
import {
  calculateMarketPerformance,
  isQuoteFromCurrentMarketDate,
  type MarketSession,
} from '@/lib/utils/market-performance'

const createYahooFinance = () => new YahooFinance({ suppressNotices: ['yahooSurvey'] })
let yahooFinance: ReturnType<typeof createYahooFinance> | null = null

function getYahooFinance(): ReturnType<typeof createYahooFinance> {
  if (!yahooFinance) {
    yahooFinance = createYahooFinance()
  }
  return yahooFinance
}

const METAL_RATE_API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json'

const METAL_TICKER_CODES: Record<string, 'xag' | 'xau' | 'xpd' | 'xpt'> = {
  'SI=F': 'xag',
  'XAG': 'xag',
  'XAGUSD=X': 'xag',
  'XAGEUR=X': 'xag',
  'GC=F': 'xau',
  'XAU': 'xau',
  'XAUUSD=X': 'xau',
  'XAUEUR=X': 'xau',
  'PA=F': 'xpd',
  'XPD': 'xpd',
  'XPDUSD=X': 'xpd',
  'XPDEUR=X': 'xpd',
  'PL=F': 'xpt',
  'XPT': 'xpt',
  'XPTUSD=X': 'xpt',
  'XPTEUR=X': 'xpt',
}

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

interface MetalRatesResponse {
  eur?: Partial<Record<'xag' | 'xau' | 'xpd' | 'xpt', number>>
}

function getMetalCode(ticker: string): 'xag' | 'xau' | 'xpd' | 'xpt' | null {
  return METAL_TICKER_CODES[ticker.toUpperCase()] ?? null
}

async function fetchMetalPriceInEur(ticker: string): Promise<PriceEntry | null> {
  const metalCode = getMetalCode(ticker)
  if (!metalCode) return null

  try {
    const response = await fetch(METAL_RATE_API_URL, {
      next: { revalidate: 300 },
    })
    if (!response.ok) return null

    const data = await response.json() as MetalRatesResponse
    const unitsPerEur = data.eur?.[metalCode]
    if (!unitsPerEur || unitsPerEur <= 0) return null

    const price = 1 / unitsPerEur

    return {
      price,
      sparkline: [price, price, price, price, price, price, price],
      currency: 'EUR',
      changePercent24h: 0,
      dailyChangePercent24h: 0,
      originalPrice: price,
      originalCurrency: 'EUR',
      marketState: 'OPEN',
    }
  } catch {
    return null
  }
}

async function fetchFxRatesToEur(): Promise<FxRatesToEur> {
  const pairs = Object.values(FX_PAIRS)
  const results = await Promise.allSettled(
    pairs.map((pair) => getYahooFinance().quote(pair) as Promise<YahooQuote>)
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
  dailyChangePercent24h?: number | null
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

function getUSMarketState(): MarketSession {
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
          dailyChangePercent24h: 0,
          originalPrice: 1.0,
          originalCurrency: 'EUR',
          marketState: 'OPEN'
        }
      }

      const metalPrice = await fetchMetalPriceInEur(ticker)
      if (metalPrice) {
        return {
          ticker,
          ...metalPrice,
        }
      }

      const [quote, chart] = await Promise.all([
        getYahooFinance().quote(ticker) as Promise<YahooQuote>,
        getYahooFinance().chart(ticker, { period1: d, interval: '1d' }).catch(() => null),
      ])

      const originalCurrency = normalizeYahooCurrency(quote.currency)
      const usMarketState = getUSMarketState()
      const quoteTimeZone = quote.exchangeTimezoneName || 'America/New_York'
      let performance = calculateMarketPerformance(quote, usMarketState)

      // Yahoo can briefly expose yesterday's extended-hours quote immediately
      // after REGULAR -> POST. Preserve today's regular daily result in that gap.
      if (
        !isQuoteFromCurrentMarketDate(performance.latestTime, new Date(), quoteTimeZone) &&
        (usMarketState === 'POST' || usMarketState === 'CLOSED') &&
        isQuoteFromCurrentMarketDate(quote.regularMarketTime, new Date(), quoteTimeZone)
      ) {
        performance = calculateMarketPerformance({
          ...quote,
          postMarketPrice: undefined,
          postMarketTime: undefined,
        }, usMarketState)
      }

      const rawPrice = performance.currentPrice
      let changePercent24h = performance.sessionChangePercent
      let dailyChangePercent24h = performance.dailyChangePercent

      // Reseteo a 0 si ha cambiado de día.
      // Si la última cotización es de ayer (o del viernes), hoy "no ha habido cambio" todavía.
      if (!isQuoteFromCurrentMarketDate(
        performance.latestTime,
        new Date(),
        quoteTimeZone,
      )) {
        changePercent24h = 0
        dailyChangePercent24h = 0
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
        dailyChangePercent24h,
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
      const { price, sparkline, currency, changePercent24h, dailyChangePercent24h, originalPrice, originalCurrency, marketState } = result.value
      prices[ticker] = {
        price,
        sparkline,
        currency,
        changePercent24h,
        dailyChangePercent24h,
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
      prices[ticker] = { price: null, sparkline: [], currency: 'EUR', changePercent24h: null, dailyChangePercent24h: null }
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
  if (tickers.length > 50) {
    throw new Error('Requested too many tickers. Maximum allowed is 50.')
  }

  // Create a unique cache key based on the requested tickers
  const sortedTickers = [...tickers].sort()
  // A session-specific key makes the percentage reset on the first refresh after
  // PRE/REGULAR/POST transitions instead of waiting for the old 5-minute entry.
  const cacheKey = `market-prices-v3-${getUSMarketState()}-${sortedTickers.join('-')}-${convertToEurFlag}`
  
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
    const summary: any = await getYahooFinance().quoteSummary(ticker, {
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
