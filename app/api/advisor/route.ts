import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()
    
    if (!tickers || !Array.isArray(tickers)) {
      return NextResponse.json({ error: 'Missing or invalid tickers array' }, { status: 400 })
    }

    const extendedStats: Record<string, any> = {}

    // Fetch stats in parallel for all tickers
    const fetchPromises = tickers.map(async (ticker: string) => {
      try {
        const quote: any = await yahooFinance.quote(ticker)
        extendedStats[ticker] = {
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
          targetMeanPrice: quote.targetMeanPrice,
        }
      } catch (err) {
        console.warn(`Could not fetch extended stats for ${ticker}`, err)
        extendedStats[ticker] = {}
      }
    })

    await Promise.allSettled(fetchPromises)

    return NextResponse.json(extendedStats)
  } catch (error) {
    console.error('API /api/advisor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
