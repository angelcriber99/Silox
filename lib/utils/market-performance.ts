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
  postMarketPrice?: number
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

function toMilliseconds(value?: number | Date): number {
  if (value instanceof Date) return value.getTime()
  return typeof value === 'number' ? value * 1000 : 0
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
  const latestTime = latestQuote ? new Date(latestQuote.date) : undefined
  
  const hasCurrentRegularMeta = meta.regularMarketTime
    ? getMarketDateKey(meta.regularMarketTime, exchangeTimezone) === marketDate
    : false
  let currentPrice = latestQuote?.close ?? (hasCurrentRegularMeta ? meta.regularMarketPrice ?? null : null)
  if (marketState === 'PRE') {
    currentPrice = meta.preMarketPrice ?? latestQuote?.close ?? (hasCurrentRegularMeta ? meta.regularMarketPrice ?? null : null)
  } else if (marketState === 'POST') {
    currentPrice = meta.postMarketPrice ?? latestQuote?.close ?? (hasCurrentRegularMeta ? meta.regularMarketPrice ?? null : null)
  } else if (marketState === 'CLOSED') {
    // The complete day includes the last post-market quote. Never fall back to
    // a quote from a previous market date, which would leak yesterday into today.
    currentPrice = latestQuote?.close ?? (hasCurrentRegularMeta ? meta.regularMarketPrice ?? null : null)
  } else if (marketState === 'REGULAR') {
    currentPrice = latestQuote?.close ?? (hasCurrentRegularMeta ? meta.regularMarketPrice ?? null : null)
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
