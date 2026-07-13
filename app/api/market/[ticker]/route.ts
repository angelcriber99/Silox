import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeYahooCurrency } from '@/lib/utils/currency'
import { requireApiUser } from '@/lib/server/api-auth'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import { getErrorMessage } from '@/lib/utils/errors'
import type { ChartOptions } from 'yahoo-finance2/modules/chart'

export const dynamic = 'force-dynamic'

const MarketRequestSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  range: z.enum(['1d', '5d', '1mo', '6mo', 'ytd', '1y', '5y', 'max']),
  type: z.string().trim().max(30),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  try {
    const yahooFinance = getYahooFinance()
    const routeParams = await params
    const { searchParams } = new URL(request.url)
    const parsed = MarketRequestSchema.safeParse({
      ticker: routeParams.ticker,
      range: searchParams.get('range') || '1mo',
      type: searchParams.get('type') || '',
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetros de mercado inválidos' }, { status: 400 })
    }
    const { ticker, range, type } = parsed.data

    const shouldFetchSummary = type === 'Acción' || type === 'Stock'
    const [quoteResult, chartResult, summaryResult] = await Promise.allSettled([
      yahooFinance.quote(ticker),
      yahooFinance.chart(ticker, { period1: getPeriod1ForRange(range), interval: getInterval(range) }),
      shouldFetchSummary
        ? yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile', 'financialData'] })
        : Promise.resolve(null),
    ])

    if (quoteResult.status === 'rejected') {
      console.error('Error fetching quote for', ticker, quoteResult.reason)
    }

    if (chartResult.status === 'rejected') {
      console.error('Error fetching chart for', ticker, chartResult.reason)
    }

    if (summaryResult.status === 'rejected') {
      console.error('Error fetching summary for', ticker, summaryResult.reason)
    }

    const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null
    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null
    const chartData = chartResult.status === 'fulfilled'
      ? chartResult.value.quotes.flatMap((point) => {
          const price = point.close ?? point.open
          return price == null
            ? []
            : [{ date: point.date.toISOString(), price, volume: point.volume }]
        })
      : []

    return NextResponse.json({
      quote: quote ? {
        marketCap: formatNumber(quote.marketCap),
        peRatio: quote.trailingPE ? quote.trailingPE.toFixed(2) : null,
        forwardPE: quote.forwardPE ? quote.forwardPE.toFixed(2) : null,
        eps: quote.epsTrailingTwelveMonths ? quote.epsTrailingTwelveMonths.toFixed(2) : null,
        divYield: quote.trailingAnnualDividendYield ? (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%' : null,
        week52High: quote.fiftyTwoWeekHigh,
        week52Low: quote.fiftyTwoWeekLow,
        volume: formatNumber(quote.regularMarketVolume),
        averageVolume: formatNumber(quote.averageDailyVolume10Day),
        open: quote.regularMarketOpen,
        previousClose: quote.regularMarketPreviousClose,
        currency: normalizeYahooCurrency(quote.currency || 'USD'),
        averageAnalystRating: quote.averageAnalystRating || null,
      } : null,
      summary: summary ? {
        profile: summary.summaryProfile || null,
        financials: summary.financialData || null
      } : null,
      chart: chartData
    })

  } catch (error: unknown) {
    console.error('Market API Error:', error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

function getInterval(range: z.infer<typeof MarketRequestSchema>['range']): ChartOptions['interval'] {
  switch (range) {
    case '1d': return '5m'
    case '5d': return '15m'
    case '1mo': return '1d'
    case '6mo': return '1d'
    case 'ytd': return '1d'
    case '1y': return '1d'
    case '5y': return '1wk'
    case 'max': return '1mo'
    default: return '1d'
  }
}

function formatNumber(num: number | undefined | null) {
  if (num === undefined || num === null) return null;
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
}

function getPeriod1ForRange(range: string): Date {
  const d = new Date()
  switch (range) {
    case '1d': d.setDate(d.getDate() - 2); break; // Give 2 days to ensure we have data including weekends
    case '5d': d.setDate(d.getDate() - 7); break;
    case '1mo': d.setMonth(d.getMonth() - 1); break;
    case '6mo': d.setMonth(d.getMonth() - 6); break;
    case 'ytd': d.setMonth(0, 1); break;
    case '1y': d.setFullYear(d.getFullYear() - 1); break;
    case '5y': d.setFullYear(d.getFullYear() - 5); break;
    case 'max': d.setFullYear(1970); break;
    default: d.setMonth(d.getMonth() - 1); break;
  }
  return d
}
