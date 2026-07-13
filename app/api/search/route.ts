import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import { getYahooFinance } from '@/lib/server/yahoo-finance'

const SearchSchema = z.object({
  query: z.string().trim().min(1).max(100)
})

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  try {
    const yahooFinance = getYahooFinance()
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
