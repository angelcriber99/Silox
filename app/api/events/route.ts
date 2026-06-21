import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export const dynamic = 'force-dynamic'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ events: [] })
    }

    const events: Array<{
      ticker: string
      date: string
      type: string
    }> = []

    const results = await Promise.allSettled(
      tickers.map(async (ticker: string) => {
          let q;
          try {
            q = await yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents'] })
          } catch (err) {
            // Ignorar
          }
          let calendar = q?.calendarEvents as any

          // Si no tenemos dividendDate y el ticker tiene un sufijo (ej: UNH.DE), probamos a buscar la matriz
          if (!calendar?.dividendDate && ticker.includes('.')) {
            const baseTicker = ticker.split('.')[0]
            try {
              const qBase = await yahooFinance.quoteSummary(baseTicker, { modules: ['calendarEvents'] })
              if (qBase?.calendarEvents?.dividendDate) {
                if (!calendar) calendar = {}
                calendar.dividendDate = qBase.calendarEvents.dividendDate
              }
            } catch (err) {
              // Ignorar
            }
          }
          
          if (calendar?.exDividendDate) {
            events.push({
              ticker,
              date: calendar.exDividendDate.toISOString(),
              type: 'Ex-Dividendo'
            })
          }
          if (calendar?.dividendDate) {
            events.push({
              ticker,
              date: calendar.dividendDate.toISOString(),
              type: 'Pago Dividendo'
            })
          }
      })
    )

    const fs = require('fs')
    fs.writeFileSync('/Users/angel/Documents/Proyectos/silox/api_debug.json', JSON.stringify({ requestTickers: tickers, resultingEvents: events }, null, 2))

    return NextResponse.json({ events })
  } catch (error) {
    console.error("Events Error:", error)
    return NextResponse.json({ error: 'Error fetching events' }, { status: 500 })
  }
}
