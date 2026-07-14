export type MarketSession = 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'

export interface ChartMeta {
  currency?: string
  exchangeTimezoneName?: string
  regularMarketPrice?: number
  chartPreviousClose?: number
  previousClose?: number
  currentTradingPeriod?: {
    pre?: { start: number | Date; end: number | Date }
    regular?: { start: number | Date; end: number | Date }
    post?: { start: number | Date; end: number | Date }
  }
}

export interface ChartQuote {
  date: Date
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
}

export interface MarketPerformance {
  currentPrice: number | null
  sessionChangePercent: number | null
  dailyChangePercent: number | null
  latestTime?: Date
  marketState: MarketSession
}

const US_MARKET_TIME_ZONE = 'America/New_York'

function percentChange(current?: number | null, baseline?: number | null): number | null {
  if (current == null || baseline == null || baseline <= 0) return null
  return ((current - baseline) / baseline) * 100
}

export function determineMarketState(meta: ChartMeta, now = new Date()): MarketSession {
  if (!meta.currentTradingPeriod) {
    return 'CLOSED'
  }

  const nowMs = now.getTime()
  
  const getMs = (val: any) => val instanceof Date ? val.getTime() : (typeof val === 'number' ? val * 1000 : 0)

  const preStart = getMs(meta.currentTradingPeriod.pre?.start)
  const preEnd = getMs(meta.currentTradingPeriod.pre?.end)
  const regStart = getMs(meta.currentTradingPeriod.regular?.start)
  const regEnd = getMs(meta.currentTradingPeriod.regular?.end)
  const postStart = getMs(meta.currentTradingPeriod.post?.start)
  const postEnd = getMs(meta.currentTradingPeriod.post?.end)

  if (preStart && nowMs >= preStart && nowMs < preEnd) return 'PRE'
  if (regStart && nowMs >= regStart && nowMs < regEnd) return 'REGULAR'
  if (postStart && nowMs >= postStart && nowMs < postEnd) return 'POST'
  
  return 'CLOSED'
}

export function extractMarketPerformance(meta: ChartMeta, quotes: ChartQuote[]): MarketPerformance {
  let lastValidClose: number | null = null
  let latestTime: Date | undefined = undefined

  if (quotes && quotes.length > 0) {
    for (let i = quotes.length - 1; i >= 0; i--) {
      const q = quotes[i]
      if (q.close !== null && q.close !== undefined) {
        lastValidClose = q.close
        latestTime = q.date
        break
      }
    }
  }

  const currentPrice = lastValidClose ?? meta.regularMarketPrice ?? null
  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null
  
  const dailyChangePercent = percentChange(currentPrice, previousClose)

  return {
    currentPrice,
    sessionChangePercent: dailyChangePercent,
    dailyChangePercent,
    latestTime,
    marketState: determineMarketState(meta)
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
