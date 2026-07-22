export type MarketSession = 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'

/**
 * Portfolio-level state. A portfolio can span several exchanges, so the badge
 * must describe whether any price is actively trading instead of letting a
 * closed/post-market European listing mask an open US session.
 */
export function aggregateMarketState(states: Array<string | undefined>): MarketSession | 'OPEN' {
  if (states.includes('REGULAR')) return 'REGULAR'
  if (states.includes('PRE')) return 'PRE'
  if (states.includes('POST')) return 'POST'
  if (states.includes('OPEN')) return 'OPEN'
  return 'CLOSED'
}

export interface TradingPeriod {
  start: number | Date
  end: number | Date
}

export interface ChartMeta {
  currency?: string
  exchangeTimezoneName?: string
  regularMarketPrice?: number
  regularMarketTime?: Date | string | number
  preMarketPrice?: number
  preMarketTime?: Date | string | number
  postMarketPrice?: number
  postMarketTime?: Date | string | number
  chartPreviousClose?: number
  previousClose?: number
  currentTradingPeriod?: {
    pre?: TradingPeriod
    regular?: TradingPeriod
    post?: TradingPeriod
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
  sessionBaseline: number | null
  dailyBaseline: number | null
  latestTime?: Date
  marketState: MarketSession
  exchangeTimezone: string
  sessionStart?: Date
  sessionEnd?: Date
  nextTransition?: Date
  isStale: boolean
  marketDate: string
}

const DEFAULT_MARKET_TIME_ZONE = 'America/New_York'
const ACTIVE_QUOTE_STALE_AFTER_MS = 10 * 60 * 1000

function toMilliseconds(value?: number | Date | string): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value * 1000
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function validPrice(value?: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null
}

function percentChange(current?: number | null, baseline?: number | null): number | null {
  if (current == null || baseline == null || baseline <= 0) return null
  return ((current - baseline) / baseline) * 100
}

function getSessionPeriod(meta: ChartMeta, state: MarketSession): TradingPeriod | undefined {
  if (state === 'PRE') return meta.currentTradingPeriod?.pre
  if (state === 'REGULAR') return meta.currentTradingPeriod?.regular
  if (state === 'POST') return meta.currentTradingPeriod?.post
  return undefined
}

export function determineMarketState(meta: ChartMeta, now = new Date()): MarketSession {
  const nowMs = now.getTime()
  const periods: Array<[MarketSession, TradingPeriod | undefined]> = [
    ['PRE', meta.currentTradingPeriod?.pre],
    ['REGULAR', meta.currentTradingPeriod?.regular],
    ['POST', meta.currentTradingPeriod?.post],
  ]

  for (const [state, period] of periods) {
    const start = toMilliseconds(period?.start)
    const end = toMilliseconds(period?.end)
    if (start && end && nowMs >= start && nowMs < end) return state
  }

  return 'CLOSED'
}

export function extractMarketPerformance(
  meta: ChartMeta,
  quotes: ChartQuote[],
  dailyQuotes: ChartQuote[] = [],
  now = new Date(),
): MarketPerformance {
  const exchangeTimezone = meta.exchangeTimezoneName || DEFAULT_MARKET_TIME_ZONE
  const marketState = determineMarketState(meta, now)
  const marketDate = getMarketDateKey(now, exchangeTimezone)
  const validQuotes = (quotes ?? [])
    .filter((quote): quote is ChartQuote & { close: number } =>
      quote.close != null && Number.isFinite(quote.close) && !Number.isNaN(new Date(quote.date).getTime()),
    )
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
  const currentDateQuotes = validQuotes.filter(
    (quote) => getMarketDateKey(quote.date, exchangeTimezone) === marketDate,
  )
  const latestQuote = currentDateQuotes.at(-1)
  let latestTime = latestQuote ? new Date(latestQuote.date) : undefined
  
  const hasCurrentRegularMeta = meta.regularMarketTime
    ? getMarketDateKey(meta.regularMarketTime, exchangeTimezone) === marketDate
    : false
  const regularPrice = validPrice(meta.regularMarketPrice)
  const prePrice = validPrice(meta.preMarketPrice)
  const postPrice = validPrice(meta.postMarketPrice)
  let currentPrice = latestQuote?.close ?? (hasCurrentRegularMeta ? regularPrice : null)
  if (marketState === 'PRE') {
    currentPrice = prePrice ?? latestQuote?.close ?? regularPrice ?? postPrice
    if (!latestTime && meta.preMarketTime) latestTime = new Date(meta.preMarketTime)
  } else if (marketState === 'POST') {
    currentPrice = postPrice ?? latestQuote?.close ?? regularPrice
    if (!latestTime && meta.postMarketTime) latestTime = new Date(meta.postMarketTime)
  } else if (marketState === 'CLOSED') {
    // A closed market still has a real valuation: retain the last traded quote.
    // At the overnight date boundary this may belong to the prior market day,
    // but only the price is carried forward; the new day's performance resets.
    currentPrice = latestQuote?.close ?? postPrice ?? regularPrice ?? prePrice
    if (!latestTime) {
      const fallbackTime = meta.postMarketTime ?? meta.regularMarketTime ?? meta.preMarketTime
      if (fallbackTime) latestTime = new Date(fallbackTime)
    }
  } else if (marketState === 'REGULAR') {
    currentPrice = latestQuote?.close ?? regularPrice ?? prePrice
    if (!latestTime && meta.regularMarketTime) latestTime = new Date(meta.regularMarketTime)
  }

  let dailyBaseline = meta.chartPreviousClose ?? meta.previousClose ?? null
  
  if (dailyQuotes && dailyQuotes.length > 0) {
    const validDailyQuotes = dailyQuotes.filter(q => q.close != null && Number.isFinite(q.close));
    const latestQuoteDateStr = latestQuote
      ? getMarketDateKey(latestQuote.date, exchangeTimezone)
      : meta.regularMarketTime
        ? getMarketDateKey(meta.regularMarketTime, exchangeTimezone)
        : marketDate;
    const previousDays = validDailyQuotes.filter(q => getMarketDateKey(q.date, exchangeTimezone) < latestQuoteDateStr);
    if (previousDays.length > 0) {
      dailyBaseline = previousDays.at(-1)?.close ?? dailyBaseline;
    }
  }

  const priceBelongsToCurrentMarketDate = latestTime
    ? getMarketDateKey(latestTime, exchangeTimezone) === marketDate
    : false
  if (!priceBelongsToCurrentMarketDate && (marketState === 'CLOSED' || marketState === 'PRE')) {
    // Before the first trade of a new market day, yesterday's close is the
    // valuation anchor. This keeps the asset visible while resetting its own
    // daily movement to zero; FX can still move the portfolio currency value.
    dailyBaseline = currentPrice
  }

  const dailyChangePercent = percentChange(currentPrice, dailyBaseline) ?? 0

  const activePeriod = getSessionPeriod(meta, marketState)
  const sessionStartMs = toMilliseconds(activePeriod?.start)
  const sessionEndMs = toMilliseconds(activePeriod?.end)
  const sessionQuotes = activePeriod
    ? currentDateQuotes.filter((quote) => {
        const time = new Date(quote.date).getTime()
        return time >= sessionStartMs && time < sessionEndMs
      })
    : []
  const sessionBaseline = sessionQuotes[0]?.close ?? null
  const sessionChangePercent = marketState === 'CLOSED'
    ? 0
    : percentChange(sessionQuotes.at(-1)?.close ?? null, sessionBaseline)
  const quoteAge = latestTime ? now.getTime() - latestTime.getTime() : Number.POSITIVE_INFINITY
  const isStale = !latestTime || quoteAge > ACTIVE_QUOTE_STALE_AFTER_MS

  return {
    currentPrice,
    sessionChangePercent: sessionChangePercent ?? 0,
    dailyChangePercent,
    sessionBaseline,
    dailyBaseline,
    latestTime,
    marketState,
    exchangeTimezone,
    sessionStart: activePeriod ? new Date(sessionStartMs) : undefined,
    sessionEnd: activePeriod ? new Date(sessionEndMs) : undefined,
    nextTransition: activePeriod ? new Date(sessionEndMs) : undefined,
    isStale,
    marketDate,
  }
}

export function getMarketDateKey(
  value: string | Date | number,
  timeZone = DEFAULT_MARKET_TIME_ZONE,
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
  timeZone = DEFAULT_MARKET_TIME_ZONE,
): boolean {
  if (!latestTime) return false
  return getMarketDateKey(latestTime, timeZone) === getMarketDateKey(now, timeZone)
}
