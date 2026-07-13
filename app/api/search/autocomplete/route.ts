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
