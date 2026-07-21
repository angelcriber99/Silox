import { describe, expect, it } from 'vitest'

import {
  determineMarketState,
  extractMarketPerformance,
  isQuoteFromCurrentMarketDate,
  type ChartMeta,
  type ChartQuote,
} from '@/lib/utils/market-performance'

const seconds = (iso: string) => new Date(iso).getTime() / 1000
const quote = (iso: string, close: number): ChartQuote => ({
  date: new Date(iso),
  open: close,
  high: close,
  low: close,
  close,
  volume: 1,
})

const meta: ChartMeta = {
  exchangeTimezoneName: 'America/New_York',
  chartPreviousClose: 100,
  regularMarketPrice: 108,
  currentTradingPeriod: {
    pre: { start: seconds('2026-07-16T08:00:00Z'), end: seconds('2026-07-16T13:30:00Z') },
    regular: { start: seconds('2026-07-16T13:30:00Z'), end: seconds('2026-07-16T20:00:00Z') },
    post: { start: seconds('2026-07-16T20:00:00Z'), end: seconds('2026-07-17T00:00:00Z') },
  },
}

describe('market session performance', () => {
  it('uses the exchange periods supplied by the provider', () => {
    expect(determineMarketState(meta, new Date('2026-07-16T12:00:00Z'))).toBe('PRE')
    expect(determineMarketState(meta, new Date('2026-07-16T15:00:00Z'))).toBe('REGULAR')
    expect(determineMarketState(meta, new Date('2026-07-16T21:00:00Z'))).toBe('POST')
  })

  it('resets the percentage when regular trading begins while retaining the full day', () => {
    const result = extractMarketPerformance(meta, [
      quote('2026-07-16T08:00:00Z', 101),
      quote('2026-07-16T13:29:00Z', 104),
      quote('2026-07-16T13:30:00Z', 105),
      quote('2026-07-16T15:00:00Z', 107),
    ], new Date('2026-07-16T15:01:00Z'))

    expect(result.sessionChangePercent).toBeCloseTo((107 / 105 - 1) * 100)
    expect(result.dailyChangePercent).toBeCloseTo(7)
    expect(result.sessionBaseline).toBe(105)
  })

  it('resets again when post-market begins', () => {
    const result = extractMarketPerformance(meta, [
      quote('2026-07-16T13:30:00Z', 103),
      quote('2026-07-16T19:59:00Z', 108),
      quote('2026-07-16T20:00:00Z', 108.5),
      quote('2026-07-16T21:00:00Z', 109),
    ], new Date('2026-07-16T21:01:00Z'))

    expect(result.sessionChangePercent).toBeCloseTo((109 / 108.5 - 1) * 100)
    expect(result.dailyChangePercent).toBeCloseTo(9)
  })

  it('never carries a prior market date into the new day', () => {
    const result = extractMarketPerformance(meta, [
      quote('2026-07-15T20:00:00Z', 106),
    ], new Date('2026-07-16T12:00:00Z'))

    expect(result.sessionChangePercent).toBe(0)
    expect(result.dailyChangePercent).toBe(0)
    expect(result.isStale).toBe(true)
  })

  it('keeps the cumulative day result after the active session closes', () => {
    const result = extractMarketPerformance(meta, [
      quote('2026-07-16T13:30:00Z', 103),
      quote('2026-07-16T23:59:00Z', 110),
    ], new Date('2026-07-17T00:30:00Z'))

    expect(result.marketState).toBe('CLOSED')
    expect(result.sessionChangePercent).toBe(0)
    expect(result.dailyChangePercent).toBeCloseTo(10)
  })

  it('treats a missing quote timestamp as non-current', () => {
    expect(isQuoteFromCurrentMarketDate(undefined)).toBe(false)
  })
})
