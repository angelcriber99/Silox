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
        // Ignorar cryptos o pares de divisas complejos si es necesario, 
        // pero yahooFinance2 suele manejar bien los tickers estándar.
        
        const summary: any = await yahooFinance.quoteSummary(ticker, {
          modules: [
            'financialData',
            'defaultKeyStatistics',
            'summaryDetail',
            'recommendationTrend'
          ]
        })
        
        const fd = summary.financialData || {}
        const dks = summary.defaultKeyStatistics || {}
        const sd = summary.summaryDetail || {}
        const rt = summary.recommendationTrend?.trend?.[0] || {}

        extendedStats[ticker] = {
          // Valuation
          forwardPE: dks.forwardPE || sd.forwardPE || null,
          trailingPE: sd.trailingPE || null,
          dividendYield: sd.dividendYield || null,
          priceToBook: dks.priceToBook || null,
          
          // Momentum
          fiftyDayAverage: sd.fiftyDayAverage || null,
          twoHundredDayAverage: sd.twoHundredDayAverage || null,
          fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh || null,
          fiftyTwoWeekLow: sd.fiftyTwoWeekLow || null,
          
          // Analyst Consensus
          targetMeanPrice: fd.targetMeanPrice || null,
          recommendationKey: fd.recommendationKey || null, // 'buy', 'hold', 'strongBuy', etc
          analystStrongBuy: rt.strongBuy || 0,
          analystBuy: rt.buy || 0,
          analystHold: rt.hold || 0,
          analystSell: rt.sell || 0,
          analystStrongSell: rt.strongSell || 0,
          
          // Profitability & Growth
          returnOnEquity: fd.returnOnEquity || null,
          profitMargins: fd.profitMargins || null,
          revenueGrowth: fd.revenueGrowth || null,
          
          // Price
          currentPrice: fd.currentPrice || null,
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
