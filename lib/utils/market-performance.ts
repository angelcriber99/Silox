export type MarketSession = 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'

export interface MarketPerformanceQuote {
  regularMarketPrice?: number
  regularMarketChangePercent?: number
  regularMarketPreviousClose?: number
  regularMarketTime?: string | Date
  preMarketPrice?: number
  preMarketChangePercent?: number
  preMarketTime?: string | Date
  postMarketPrice?: number
  postMarketChangePercent?: number
  postMarketTime?: string | Date
  exchangeTimezoneName?: string
}

export interface MarketPerformance {
  currentPrice: number | null
  sessionChangePercent: number | null
  dailyChangePercent: number | null
  latestTime?: string | Date
}

const US_MARKET_TIME_ZONE = 'America/New_York'
const MAX_PREVIOUS_POST_AGE_MS = 4 * 24 * 60 * 60 * 1000

function percentChange(current?: number | null, baseline?: number | null): number | null {
  if (current == null || baseline == null || baseline <= 0) return null
  return ((current - baseline) / baseline) * 100
}

function isUsablePreviousPost(quote: MarketPerformanceQuote): boolean {
  if (!quote.postMarketPrice || quote.postMarketPrice <= 0) return false
  if (!quote.postMarketTime || !quote.preMarketTime) return true

  const postTime = new Date(quote.postMarketTime).getTime()
  const preTime = new Date(quote.preMarketTime).getTime()
  const age = preTime - postTime

  return Number.isFinite(age) && age >= 0 && age <= MAX_PREVIOUS_POST_AGE_MS
}

/**
 * Separates the percentage for the active session from the full trading-day
 * movement. The UI percentage may reset while daily money and history continue
 * to use dailyChangePercent.
 */
export function calculateMarketPerformance(
  quote: MarketPerformanceQuote,
  session: MarketSession,
): MarketPerformance {
  if (session === 'PRE') {
    const currentPrice = quote.preMarketPrice ?? quote.regularMarketPrice ?? null
    const sessionBaseline = isUsablePreviousPost(quote)
      ? quote.postMarketPrice
      : quote.regularMarketPrice

    return {
      currentPrice,
      sessionChangePercent: percentChange(currentPrice, sessionBaseline) ?? quote.preMarketChangePercent ?? null,
      dailyChangePercent: percentChange(currentPrice, quote.regularMarketPreviousClose) ?? quote.preMarketChangePercent ?? null,
      latestTime: quote.preMarketTime ?? quote.regularMarketTime,
    }
  }

  if (session === 'POST') {
    const currentPrice = quote.postMarketPrice ?? quote.regularMarketPrice ?? null

    return {
      currentPrice,
      sessionChangePercent: percentChange(currentPrice, quote.regularMarketPrice) ?? quote.postMarketChangePercent ?? null,
      dailyChangePercent: percentChange(currentPrice, quote.regularMarketPreviousClose) ?? quote.postMarketChangePercent ?? null,
      latestTime: quote.postMarketTime ?? quote.regularMarketTime,
    }
  }

  if (session === 'REGULAR') {
    const currentPrice = quote.regularMarketPrice ?? null

    return {
      currentPrice,
      sessionChangePercent:
        quote.regularMarketChangePercent ??
        percentChange(currentPrice, quote.regularMarketPreviousClose),
      dailyChangePercent:
        quote.regularMarketChangePercent ??
        percentChange(currentPrice, quote.regularMarketPreviousClose),
      latestTime: quote.regularMarketTime,
    }
  }

  const currentPrice = quote.postMarketPrice ?? quote.regularMarketPrice ?? null
  return {
    currentPrice,
    // Keep the last completed session visible while the market is inactive.
    // The next PRE quote gets a new baseline and performs the actual reset.
    sessionChangePercent: quote.postMarketPrice
      ? percentChange(currentPrice, quote.regularMarketPrice)
      : quote.regularMarketChangePercent ??
        percentChange(currentPrice, quote.regularMarketPreviousClose),
    dailyChangePercent: percentChange(currentPrice, quote.regularMarketPreviousClose),
    latestTime: quote.postMarketTime ?? quote.regularMarketTime,
  }
}

export function getMarketDateKey(
  value: string | Date,
  timeZone = US_MARKET_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isQuoteFromCurrentMarketDate(
  latestTime: string | Date | undefined,
  now = new Date(),
  timeZone = US_MARKET_TIME_ZONE,
): boolean {
  if (!latestTime) return true
  return getMarketDateKey(latestTime, timeZone) === getMarketDateKey(now, timeZone)
}
