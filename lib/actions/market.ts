"use server"

import { unstable_noStore } from 'next/cache'

import {
  convertSeriesToEur,
  convertToEur,
  FX_PAIRS,
  normalizeYahooCurrency,
  normalizeYahooPrice,
  type FxRatesToEur,
} from '@/lib/utils/currency'
import {
  extractMarketPerformance,
  type ChartMeta,
  type ChartQuote,
} from '@/lib/utils/market-performance'
import { mapSettledWithConcurrency } from '@/lib/utils/async'
import {
  buildMetalChartPoints,
  buildMetalPriceMetrics,
  getMetalChartDateKeys,
  type MetalChartPoint,
  type MetalChartRange,
  type MetalRateCode,
  type MetalRateSnapshot,
} from '@/lib/utils/metal-market'
import { getYahooFinance } from '@/lib/server/yahoo-finance'

const METAL_RATE_API_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api'
const METAL_HISTORY_DAYS = 6

const METAL_TICKER_CODES: Record<string, MetalRateCode> = {
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
  preMarketChangePercent?: number
  postMarketPrice?: number
  postMarketChangePercent?: number
  regularMarketPreviousClose?: number
  regularMarketTime?: string | Date
  preMarketTime?: string | Date
  postMarketTime?: string | Date
  exchangeTimezoneName?: string
  marketState?: string
}

interface MetalRatesResponse {
  date?: string
  eur?: Partial<Record<MetalRateCode, number>>
}

function getMetalCode(ticker: string): MetalRateCode | null {
  return METAL_TICKER_CODES[ticker.toUpperCase()] ?? null
}

function getPreviousDateKeys(date: string, count: number): string[] {
  const cursor = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(cursor.getTime())) return []

  return Array.from({ length: count }, (_, index) => {
    const value = new Date(cursor)
    value.setUTCDate(value.getUTCDate() - index - 1)
    return value.toISOString().slice(0, 10)
  })
}

async function fetchMetalRates(date: 'latest' | string): Promise<MetalRateSnapshot | null> {
  const urls = [
    `${METAL_RATE_API_BASE}@${date}/v1/currencies/eur.json`,
    `https://${date}.currency-api.pages.dev/v1/currencies/eur.json`,
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        next: { revalidate: date === 'latest' ? 300 : 86_400 },
      })
      if (!response.ok) continue

      const data = await response.json() as MetalRatesResponse
      if (!data.date || !data.eur) continue

      return { date: data.date, rates: data.eur }
    } catch {
      // Try the documented fallback host before giving up.
    }
  }

  return null
}

interface MetalMarketHistory {
  latest: MetalRateSnapshot
  history: MetalRateSnapshot[]
}

async function fetchMetalMarketHistory(): Promise<MetalMarketHistory | null> {
  const latest = await fetchMetalRates('latest')
  if (!latest) return null

  const history = (await Promise.all(
    getPreviousDateKeys(latest.date, METAL_HISTORY_DAYS).map(fetchMetalRates),
  )).filter((snapshot): snapshot is MetalRateSnapshot => snapshot != null)

  return { latest, history }
}

export async function fetchMetalChartInEur(
  ticker: string,
  range: MetalChartRange,
): Promise<MetalChartPoint[] | null> {
  const metalCode = getMetalCode(ticker)
  if (!metalCode) return null

  const latest = await fetchMetalRates('latest')
  if (!latest) return null

  const dates = getMetalChartDateKeys(latest.date, range)
    .filter((date) => date !== latest.date)
  const history = (await Promise.all(dates.map(fetchMetalRates)))
    .filter((snapshot): snapshot is MetalRateSnapshot => snapshot != null)

  return buildMetalChartPoints(metalCode, [...history, latest])
}

function getMetalPriceEntry(
  ticker: string,
  market: MetalMarketHistory,
): PriceEntry | null {
  const metalCode = getMetalCode(ticker)
  if (!metalCode) return null

  const metrics = buildMetalPriceMetrics(metalCode, market.latest, market.history)
  if (!metrics) return null

  const providerTime = new Date(`${market.latest.date}T23:59:59.000Z`)
  const isStale = Number.isNaN(providerTime.getTime())
    || Date.now() - providerTime.getTime() > 72 * 60 * 60 * 1000

  return {
    price: metrics.price,
    sparkline: metrics.sparkline,
    currency: 'EUR',
    changePercent24h: metrics.changePercent,
    dailyChangePercent24h: metrics.changePercent,
    originalPrice: metrics.price,
    originalCurrency: 'EUR',
    marketState: 'OPEN',
    latestTime: Number.isNaN(providerTime.getTime()) ? undefined : providerTime.toISOString(),
    isStale,
  }
}

let lastKnownFxRates: FxRatesToEur = { EUR: 1 }

async function fetchFxRatesToEur(): Promise<FxRatesToEur> {
  const pairs = Object.values(FX_PAIRS)
  const results = await Promise.allSettled(
    pairs.map((pair) => getYahooFinance().quote(pair) as Promise<YahooQuote>)
  )

  const rates: FxRatesToEur = { EUR: 1 }
  let allFailed = true

  pairs.forEach((pair, index) => {
    const result = results[index]
    const foreign = pair.replace('EUR', '').replace('=X', '')
    
    if (result.status !== 'fulfilled') {
      if (lastKnownFxRates[foreign]) rates[foreign] = lastKnownFxRates[foreign]
      return
    }

    const raw = result.value.regularMarketPrice
    if (!raw || raw <= 0) {
      if (lastKnownFxRates[foreign]) rates[foreign] = lastKnownFxRates[foreign]
      return
    }

    rates[foreign] = raw
    lastKnownFxRates[foreign] = raw
    allFailed = false
  })

  if (allFailed && Object.keys(lastKnownFxRates).length > 1) {
    return { ...lastKnownFxRates }
  }

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
  latestTime?: string
  exchangeTimezone?: string
  sessionStart?: string
  sessionEnd?: string
  nextTransition?: string
  isStale?: boolean
}

export interface MarketPricesResult {
  prices: Record<string, PriceEntry>
  fxRates?: FxRatesToEur
  displayCurrency: string
  marketState: string
}



// In-memory cache for the server action to prevent Yahoo rate limits
// while bypassing Next.js unstable_cache completely.
interface ActionCacheEntry {
  data: MarketPricesResult
  expiresAt: number
}
const actionCache = new Map<string, ActionCacheEntry>()
const lastKnownPriceCache = new Map<string, PriceEntry>()
const ACTIVE_CACHE_TTL = 8_000
const CLOSED_CACHE_TTL = 60_000
const sparklineCache = new Map<string, { values: number[]; expiresAt: number }>()

function getResultCacheTtl(result: MarketPricesResult): number {
  return ['PRE', 'REGULAR', 'POST', 'OPEN'].includes(result.marketState)
    ? ACTIVE_CACHE_TTL
    : CLOSED_CACHE_TTL
}

export async function fetchMarketPricesDirect(
  tickers: string[],
  convertToEurFlag: boolean = false
): Promise<MarketPricesResult> {
  unstable_noStore()
  
  const cacheKey = `${tickers.slice().sort().join(',')}:${convertToEurFlag}`
  
  const cached = actionCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  const freshData = await _fetchMarketPrices(tickers, convertToEurFlag)
  const prices = { ...freshData.prices }
  for (const ticker of tickers) {
    const current = prices[ticker]
    const previous = lastKnownPriceCache.get(`${ticker}:${convertToEurFlag}`)
    if (current?.price == null && previous?.price != null) {
      prices[ticker] = { ...previous, isStale: true }
    } else if (current?.price != null) {
      lastKnownPriceCache.set(`${ticker}:${convertToEurFlag}`, current)
    }
  }
  if (lastKnownPriceCache.size > 500) {
    const oldest = lastKnownPriceCache.keys().next().value
    if (oldest) lastKnownPriceCache.delete(oldest)
  }
  const data = { ...freshData, prices }
  
  // Cleanup old entries
  if (actionCache.size > 200) {
    const now = Date.now()
    for (const [k, v] of actionCache) {
      if (now > v.expiresAt) actionCache.delete(k)
    }
  }
  
  actionCache.set(cacheKey, { data, expiresAt: Date.now() + getResultCacheTtl(data) })
  return data
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
  const metalMarketPromise = tickers.some((ticker) => getMetalCode(ticker) != null)
    ? fetchMetalMarketHistory()
    : Promise.resolve(null)

  const results = await mapSettledWithConcurrency(
    tickers,
    8,
    async (ticker: string) => {
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
          marketState: 'OPEN',
          latestTime: new Date().toISOString(),
          isStale: false,
        }
      }

      const metalMarket = await metalMarketPromise
      const metalPrice = metalMarket ? getMetalPriceEntry(ticker, metalMarket) : null
      if (metalPrice) {
        return {
          ticker,
          ...metalPrice,
        }
      }

      const cachedSparkline = sparklineCache.get(ticker)
      const chart1dPromise = cachedSparkline && cachedSparkline.expiresAt > Date.now()
        ? Promise.resolve(null)
        : getYahooFinance().chart(ticker, { period1: d, interval: '1d' }).catch(() => null)
      const [chart1m, chart1d] = await Promise.all([
        getYahooFinance().chart(ticker, { interval: '1m', period1: new Date(Date.now() - 24 * 60 * 60 * 1000), includePrePost: true }).catch(() => null),
        chart1dPromise,
      ])

      if (!chart1m) {
        throw new Error(`Failed to fetch 1m chart for ${ticker}`)
      }

      const meta = chart1m.meta
      const quotes = (chart1m.quotes as ChartQuote[]) || []
      
      const yahooCurrency = meta.currency || 'USD'
      const originalCurrency = normalizeYahooCurrency(yahooCurrency)
      const performance = extractMarketPerformance(meta as ChartMeta, quotes, (chart1d?.quotes as ChartQuote[]) || [])

      const rawPrice = performance.currentPrice === null
        ? null
        : normalizeYahooPrice(performance.currentPrice, yahooCurrency)
      const changePercent24h = performance.sessionChangePercent
      const dailyChangePercent24h = performance.dailyChangePercent
      let sparkline: number[] = cachedSparkline?.values ?? []
      if (chart1d?.quotes) {
        sparkline = chart1d.quotes
          .map((q) => q.close)
          .filter((c): c is number => c !== null && c !== undefined)
          .map((value) => normalizeYahooPrice(value, yahooCurrency))
        sparklineCache.set(ticker, { values: sparkline, expiresAt: Date.now() + 5 * 60_000 })
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
        marketState: performance.marketState,
        latestTime: performance.latestTime?.toISOString(),
        exchangeTimezone: performance.exchangeTimezone,
        sessionStart: performance.sessionStart?.toISOString(),
        sessionEnd: performance.sessionEnd?.toISOString(),
        nextTransition: performance.nextTransition?.toISOString(),
        isStale: performance.isStale,
      }
    },
  )

  const prices: Record<string, PriceEntry> = {}
  let globalMarketState = 'CLOSED'

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const ticker = tickers[i]

    if (result.status === 'fulfilled') {
      const { price, sparkline, currency, changePercent24h, dailyChangePercent24h, originalPrice, originalCurrency, marketState, latestTime, exchangeTimezone, sessionStart, sessionEnd, nextTransition, isStale } = result.value
      prices[ticker] = {
        price,
        sparkline,
        currency,
        changePercent24h,
        dailyChangePercent24h,
        originalPrice,
        originalCurrency,
        marketState,
        latestTime,
        exchangeTimezone,
        sessionStart,
        sessionEnd,
        nextTransition,
        isStale,
      }
      
      if (marketState === 'PRE') {
        globalMarketState = 'PRE'
      } else if (marketState === 'POST' && globalMarketState !== 'PRE') {
        globalMarketState = 'POST'
      } else if (marketState === 'REGULAR' && globalMarketState !== 'PRE' && globalMarketState !== 'POST') {
        globalMarketState = 'REGULAR'
      } else if (marketState === 'OPEN' && globalMarketState === 'CLOSED') {
        globalMarketState = 'OPEN'
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
  // We no longer use unstable_cache because it is highly unreliable on Vercel.
  // Instead, we use fetchMarketPricesDirect which has a reliable in-memory 60s cache.
  return fetchMarketPricesDirect(sortedTickers, convertToEurFlag)
}

export interface AssetDetails {
  currentPrice?: number
  targetMeanPrice?: number
  recommendationKey?: string
  analystStrongBuy?: number
  analystBuy?: number
  analystHold?: number
  analystSell?: number
  analystStrongSell?: number
  forwardPE?: number
  trailingPE?: number
  dividendYield?: number
  profitMargins?: number
  returnOnEquity?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  twoHundredDayAverage?: number
  marketCap?: number
  volume?: number
}

export async function fetchAssetDetails(ticker: string): Promise<AssetDetails | null> {
  if (!ticker || ticker === 'CASH') return null

  try {
    const summary = await getYahooFinance().quoteSummary(ticker, {
      modules: [
        'financialData',
        'defaultKeyStatistics',
        'summaryDetail',
        'recommendationTrend'
      ]
    })
    
    const fd = summary.financialData
    const ks = summary.defaultKeyStatistics
    const sd = summary.summaryDetail
    const rt = summary.recommendationTrend?.trend?.[0]

    return {
      currentPrice: fd?.currentPrice,
      targetMeanPrice: fd?.targetMeanPrice,
      recommendationKey: fd?.recommendationKey,
      analystStrongBuy: rt?.strongBuy,
      analystBuy: rt?.buy,
      analystHold: rt?.hold,
      analystSell: rt?.sell,
      analystStrongSell: rt?.strongSell,
      forwardPE: ks?.forwardPE,
      trailingPE: sd?.trailingPE,
      dividendYield: sd?.dividendYield,
      profitMargins: fd?.profitMargins,
      returnOnEquity: fd?.returnOnEquity,
      fiftyTwoWeekHigh: sd?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: sd?.fiftyTwoWeekLow,
      twoHundredDayAverage: sd?.twoHundredDayAverage,
      marketCap: sd?.marketCap,
      volume: sd?.volume
    }
  } catch (error) {
    console.error(`Error fetching asset details for ${ticker}:`, error)
    return null
  }
}
