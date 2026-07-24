import 'server-only'

import { FX_PAIRS, normalizeYahooCurrency, normalizeYahooPrice } from '@/lib/utils/currency'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import { mapSettledWithConcurrency } from '@/lib/utils/async'
import type { HistoricalMarketSeries, HistoricalQuote } from '@/lib/domain/portfolio/historical-performance'

export interface HistoricalMarketAsset {
  id: string
  ticker: string
  type: string
  currency: string
}

const METAL_TICKER_ALIASES: Record<string, string> = {
  XAG: 'SI=F',
  XAU: 'GC=F',
  XPD: 'PA=F',
  XPT: 'PL=F',
}

function isCashTicker(ticker: string): boolean {
  const normalized = ticker.toUpperCase()
  return normalized.startsWith('CASH') || normalized === 'REVOLUT'
}

export function historicalYahooTicker(asset: HistoricalMarketAsset): string {
  const ticker = asset.ticker.toUpperCase()
  if (METAL_TICKER_ALIASES[ticker]) return METAL_TICKER_ALIASES[ticker]
  if (asset.type.toLowerCase() === 'crypto' && !ticker.includes('-')) return `${ticker}-USD`
  if (ticker.startsWith('0P') && !ticker.includes('.')) return `${ticker}.F`
  return ticker
}

function periodDate(date: string, offsetDays: number): Date {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + offsetDays)
  return value
}

function quoteSeries(quotes: Array<{ date: Date; close?: number | null }>, currency: string): HistoricalQuote[] {
  return quotes
    .filter((quote) => Number.isFinite(quote.close) && quote.close! > 0)
    .map((quote) => ({
      date: quote.date.toISOString().slice(0, 10),
      close: normalizeYahooPrice(quote.close!, currency),
    }))
    .filter((quote) => Number.isFinite(quote.close) && quote.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
}

/**
 * Loads daily market and FX closes for a historical valuation. The caller can
 * safely fall back to persisted snapshots when an instrument has no reliable
 * series; no quote is fabricated from the transaction price.
 */
export async function fetchHistoricalMarketData(
  assets: HistoricalMarketAsset[],
  from: string,
  to: string,
): Promise<{
  marketSeriesByAsset: Record<string, HistoricalMarketSeries>
  fxSeriesByCurrency: Record<string, HistoricalQuote[]>
}> {
  const uniqueAssets = Array.from(new Map(
    assets.map((asset) => [asset.id, asset]),
  ).values())
  const marketAssets = uniqueAssets.filter((asset) => !isCashTicker(asset.ticker))
  const period1 = periodDate(from, -14)
  const period2 = periodDate(to, 2)

  const marketSeriesByAsset: Record<string, HistoricalMarketSeries> = {}
  const marketResults = await mapSettledWithConcurrency(marketAssets, 4, async (asset) => {
    const chart = await getYahooFinance().chart(historicalYahooTicker(asset), { period1, period2, interval: '1d' })
    const quoteCurrency = normalizeYahooCurrency(chart.meta?.currency ?? asset.currency)
    return {
      assetId: asset.id,
      series: {
        currency: quoteCurrency,
        quotes: quoteSeries(chart.quotes ?? [], chart.meta?.currency ?? asset.currency),
      } satisfies HistoricalMarketSeries,
    }
  })
  for (const result of marketResults) {
    if (result.status !== 'fulfilled' || result.value.series.quotes.length === 0) continue
    marketSeriesByAsset[result.value.assetId] = result.value.series
  }

  const currencies = new Set<string>(uniqueAssets.map((asset) => asset.currency.toUpperCase()))
  for (const series of Object.values(marketSeriesByAsset)) currencies.add(series.currency.toUpperCase())
  currencies.delete('EUR')

  const fxSeriesByCurrency: Record<string, HistoricalQuote[]> = {}
  const currenciesWithPair = Array.from(currencies).filter((currency) => FX_PAIRS[currency])
  const fxResults = await mapSettledWithConcurrency(currenciesWithPair, 4, async (currency) => {
    const chart = await getYahooFinance().chart(FX_PAIRS[currency], { period1, period2, interval: '1d' })
    return { currency, quotes: quoteSeries(chart.quotes ?? [], currency) }
  })
  for (const result of fxResults) {
    if (result.status !== 'fulfilled' || result.value.quotes.length === 0) continue
    fxSeriesByCurrency[result.value.currency] = result.value.quotes
  }

  return { marketSeriesByAsset, fxSeriesByCurrency }
}
