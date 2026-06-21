import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { z } from 'zod'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const SearchSchema = z.object({
  query: z.string().min(1).max(100)
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const parsed = SearchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { query } = parsed.data

    const searchResult = await yahooFinance.search(query) as any
    const quotes = searchResult.quotes || []
    const firstQuote = quotes.find((q: any) => q.isYahooFinance === true || q.symbol) || quotes[0]
    
    if (!firstQuote || !firstQuote.symbol) {
      return NextResponse.json({ error: 'No se encontraron resultados' }, { status: 404 })
    }

    return NextResponse.json({ 
      ticker: firstQuote.symbol, 
      name: firstQuote.longname || firstQuote.shortname,
      exchange: firstQuote.exchDisp
    })
  } catch (error) {
    console.error('Error buscando en Yahoo Finance:', error)
    return NextResponse.json(
      { error: 'Error interno de búsqueda' },
      { status: 500 }
    )
  }
}
