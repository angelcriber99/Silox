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
    
    // Filter out quotes without symbols and limit to top 5
    const results = quotes
      .filter((q: any) => q.symbol)
      .slice(0, 5)
      .map((q: any) => ({
        ticker: q.symbol,
        name: q.longname || q.shortname || '',
        exchange: q.exchDisp || '',
        type: q.quoteType || ''
      }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error buscando en Yahoo Finance (autocomplete):', error)
    return NextResponse.json(
      { error: 'Error interno de búsqueda' },
      { status: 500 }
    )
  }
}
