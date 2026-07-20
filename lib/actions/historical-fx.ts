"use server"

import { FX_PAIRS } from '@/lib/utils/currency'
import { historicalFxKey } from '@/lib/domain/portfolio/contributions'
import { getYahooFinance } from '@/lib/server/yahoo-finance'

export interface HistoricalFxRequest {
  currency: string
  date: string
}

const historicalRateCache = new Map<string, number>()
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_REQUESTS = 2_000
const MAX_UNIQUE_REQUESTS = 500

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

export async function fetchHistoricalFxRates(
  requests: HistoricalFxRequest[],
): Promise<Record<string, number>> {
  if (!Array.isArray(requests) || requests.length > MAX_REQUESTS) {
    throw new Error('Solicitud de divisas histÃ³ricas invÃ¡lida')
  }

  const unique = new Map<string, HistoricalFxRequest>()
  for (const request of requests) {
    const currency = String(request.currency ?? '').toUpperCase()
    const date = String(request.date ?? '').slice(0, 10)
    if (!ISO_DATE.test(date) || (currency !== 'EUR' && !FX_PAIRS[currency])) continue
    unique.set(historicalFxKey(currency, date), { currency, date })
  }
  if (unique.size > MAX_UNIQUE_REQUESTS) {
    throw new Error('Demasiadas fechas de divisas histÃ³ricas en una sola solicitud')
  }

  const result: Record<string, number> = {}
  const grouped = new Map<string, string[]>()
  for (const [key, request] of unique) {
    if (request.currency === 'EUR') {
      result[key] = 1
      continue
    }
    const cached = historicalRateCache.get(key)
    if (cached) {
      result[key] = cached
      continue
    }
    const dates = grouped.get(request.currency) ?? []
    dates.push(request.date)
    grouped.set(request.currency, dates)
  }

  await Promise.all(Array.from(grouped, async ([currency, dates]) => {
    const orderedDates = [...new Set(dates)].sort()
    const period1 = utcDate(orderedDates[0])
    period1.setUTCDate(period1.getUTCDate() - 8)
    const period2 = utcDate(orderedDates.at(-1)!)
    period2.setUTCDate(period2.getUTCDate() + 2)

    const chart = await getYahooFinance().chart(FX_PAIRS[currency], {
      period1,
      period2,
      interval: '1d',
    })
    const quotes = chart.quotes
      .filter((quote) => Number.isFinite(quote.close) && quote.close! > 0)
      .map((quote) => ({ date: quote.date.toISOString().slice(0, 10), rate: quote.close! }))
      .sort((left, right) => left.date.localeCompare(right.date))

    for (const date of orderedDates) {
      // Weekend/holiday movements use the latest official close available on
      // or before the transaction date. Never use a future FX observation.
      const quote = quotes.findLast((candidate) => candidate.date <= date)
      if (!quote) continue
      const key = historicalFxKey(currency, date)
      historicalRateCache.set(key, quote.rate)
      result[key] = quote.rate
    }
  }))

  return result
}
