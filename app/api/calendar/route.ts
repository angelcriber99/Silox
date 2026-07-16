import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import { getYahooFinance } from '@/lib/server/yahoo-finance'

const CalendarSchema = z.object({
  tickers: z.array(z.string()).min(1).max(20),
})

export type CalendarEvent = {
  id: string
  ticker: string
  date: string
  type: 'EARNINGS' | 'DIVIDEND' | 'EX_DIVIDEND' | 'AI_EVENT'
  title: string
  description?: string
}

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  try {
    const yahooFinance = getYahooFinance()
    const body = await request.json()
    
    const parsed = CalendarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { tickers } = parsed.data

    const events: CalendarEvent[] = []

    await Promise.allSettled(
      tickers.map(async (ticker) => {
        try {
          const summary = await yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents'] })
          const calendarEvents = summary.calendarEvents

          if (!calendarEvents) return

          // Earnings
          if (calendarEvents.earnings?.earningsDate && calendarEvents.earnings.earningsDate.length > 0) {
            const eDate = calendarEvents.earnings.earningsDate[0]
            if (eDate) {
              events.push({
                id: `${ticker}-earnings-${new Date(eDate).getTime()}`,
                ticker,
                date: new Date(eDate).toISOString(),
                type: 'EARNINGS',
                title: 'Resultados Financieros (Earnings)',
              })
            }
          }

          // Dividend Date
          if (calendarEvents.dividendDate) {
            events.push({
              id: `${ticker}-dividend-${new Date(calendarEvents.dividendDate).getTime()}`,
              ticker,
              date: new Date(calendarEvents.dividendDate).toISOString(),
              type: 'DIVIDEND',
              title: 'Pago de Dividendo',
            })
          }

          // Ex-Dividend Date
          if (calendarEvents.exDividendDate) {
            events.push({
              id: `${ticker}-exdividend-${new Date(calendarEvents.exDividendDate).getTime()}`,
              ticker,
              date: new Date(calendarEvents.exDividendDate).toISOString(),
              type: 'EX_DIVIDEND',
              title: 'Fecha de Corte (Ex-Dividend)',
              description: 'Último día para comprar la acción y tener derecho al dividendo.'
            })
          }

        } catch (error) {
          console.warn(`Error fetching calendar events for ${ticker}:`, error)
        }
      })
    )

    // Sort events by date ascending
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({ events })

  } catch (error) {
    console.error('Error in /api/calendar:', error)
    return NextResponse.json(
      { error: 'Error procesando el calendario' },
      { status: 500 }
    )
  }
}
