import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { z } from 'zod'
import {
  convertSeriesToEur,
  convertToEur,
  FX_PAIRS,
  normalizeYahooCurrency,
  type FxRatesToEur,
} from '@/lib/utils/currency'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

interface YahooQuote {
  regularMarketPrice?: number
  regularMarketChangePercent?: number
  currency?: string
}

const PreciosSchema = z.object({
  tickers: z.array(z.string().min(1).max(20)).min(1).max(100),
  convertToEur: z.boolean().optional().default(false),
})

async function fetchFxRatesToEur(): Promise<FxRatesToEur> {
  const pairs = Object.values(FX_PAIRS)
  const results = await Promise.allSettled(
    pairs.map((pair) => yahooFinance.quote(pair) as Promise<YahooQuote>)
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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const parsed = PreciosSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { tickers, convertToEur: shouldConvert } = parsed.data

    const d = new Date()
    d.setDate(d.getDate() - 7)

    const fxRates = shouldConvert ? await fetchFxRatesToEur() : null

    const results = await Promise.allSettled(
      tickers.map(async (ticker: string) => {
        const [quote, chart] = await Promise.all([
          yahooFinance.quote(ticker) as Promise<YahooQuote>,
          yahooFinance.chart(ticker, { period1: d, interval: '1d' }).catch(() => null),
        ])

        const originalCurrency = normalizeYahooCurrency(quote.currency)
        const rawPrice = quote.regularMarketPrice ?? null
        const changePercent24h = quote.regularMarketChangePercent ?? null

        let sparkline: number[] = []
        if (chart?.quotes) {
          sparkline = chart.quotes
            .map((q) => q.close)
            .filter((c): c is number => c !== null && c !== undefined)
        }

        let price = rawPrice
        let currency = originalCurrency

        if (shouldConvert && fxRates && rawPrice !== null) {
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
          originalPrice: rawPrice,
          originalCurrency,
        }
      })
    )

    interface PriceEntry {
      price: number | null;
      sparkline: number[];
      currency: string;
      changePercent24h?: number | null;
      originalPrice?: number | null;
      originalCurrency?: string;
    }
    const prices: Record<string, PriceEntry> = {}

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const ticker = tickers[i]

      if (result.status === 'fulfilled') {
        const { price, sparkline, currency, changePercent24h, originalPrice, originalCurrency } =
          result.value
        prices[ticker] = {
          price,
          sparkline,
          currency,
          changePercent24h,
          originalPrice,
          originalCurrency,
        }
      } else if (ticker) {
        prices[ticker] = { price: null, sparkline: [], currency: 'EUR', changePercent24h: null }
      }
    }

    return NextResponse.json(
      {
        prices,
        fxRates: shouldConvert ? fxRates : undefined,
        displayCurrency: shouldConvert ? 'EUR' : 'native',
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Error interno al obtener precios' },
      { status: 500 }
    )
  }
}
