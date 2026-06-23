import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { normalizeYahooCurrency } from '@/lib/utils/currency'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '1mo'

    const [quoteResult, chartResult] = await Promise.allSettled([
      yahooFinance.quote(ticker),
      yahooFinance.chart(ticker, { period1: getPeriod1ForRange(range), interval: getInterval(range) })
    ])

    let quote: any = null
    if (quoteResult.status === 'fulfilled') {
      quote = quoteResult.value
    } else {
      console.error('Error fetching quote for', ticker, quoteResult.reason)
    }

    let chartData = []
    if (chartResult.status === 'fulfilled') {
      const res = chartResult.value as any
      chartData = res.quotes.map((q: any) => ({
        date: q.date.toISOString(),
        price: q.close || q.open,
        volume: q.volume
      })).filter((q: any) => q.price !== null && q.price !== undefined)
    } else {
      console.error('Error fetching chart for', ticker, chartResult.reason)
    }

    return NextResponse.json({
      quote: quote ? {
        marketCap: formatNumber(quote.marketCap),
        peRatio: quote.trailingPE ? quote.trailingPE.toFixed(2) : null,
        divYield: quote.trailingAnnualDividendYield ? (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%' : null,
        week52High: quote.fiftyTwoWeekHigh,
        week52Low: quote.fiftyTwoWeekLow,
        volume: formatNumber(quote.regularMarketVolume),
        averageVolume: formatNumber(quote.averageDailyVolume10Day),
        open: quote.regularMarketOpen,
        previousClose: quote.regularMarketPreviousClose,
        currency: normalizeYahooCurrency(quote.currency || 'USD')
      } : null,
      chart: chartData
    })

  } catch (error: any) {
    console.error('Market API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getInterval(range: string): any {
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
