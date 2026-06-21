import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const EventsSchema = z.object({
  tickers: z.array(z.string().min(1).max(20)).max(100).optional().default([]),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const parsed = EventsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { tickers } = parsed.data

    if (tickers.length === 0) {
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

    return NextResponse.json({ events })
  } catch (error) {
    console.error("Events Error:", error)
    return NextResponse.json({ error: 'Error fetching events' }, { status: 500 })
  }
}
