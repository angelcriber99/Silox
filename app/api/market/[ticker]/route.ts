import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { normalizeYahooCurrency } from '@/lib/utils/currency'

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
      YahooFinance.quote(ticker),
      YahooFinance.chart(ticker, { range: range as any, interval: getInterval(range) })
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
