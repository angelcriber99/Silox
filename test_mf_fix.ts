import { extractMarketPerformance, ChartMeta, ChartQuote } from './lib/utils/market-performance'

const meta: ChartMeta = {
  regularMarketPrice: 11.50, // Dropped!
  previousClose: 11.7435,
  exchangeTimezoneName: 'America/New_York'
}

const dailyQuotes: ChartQuote[] = [
  { date: new Date('2026-07-17T06:00:00.000Z'), close: 11.7435, open: 11.7435, high: 11.7435, low: 11.7435, volume: 0 },
  { date: new Date('2026-07-20T06:00:00.000Z'), close: null, open: null, high: null, low: null, volume: null },
]

const result = extractMarketPerformance(meta, [], dailyQuotes, new Date('2026-07-20T12:00:00.000Z'))
console.log("Daily change percent:", result.dailyChangePercent)
console.log("Is Stale:", result.isStale)
