import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query requerido' }, { status: 400 })
    }

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
