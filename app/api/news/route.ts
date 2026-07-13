import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import { getYahooFinance } from '@/lib/server/yahoo-finance'

const NewsQuerySchema = z.string().trim().min(1).max(30)

export async function GET(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const ticker = NewsQuerySchema.safeParse(searchParams.get('ticker'))

  if (!ticker.success) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
  }

  try {
    const yahooFinance = getYahooFinance()
    const result = await yahooFinance.search(ticker.data, { newsCount: 10 })
    return NextResponse.json({ news: result.news })
  } catch (error) {
    console.error('Error fetching news:', error)
    return NextResponse.json({ error: 'Error fetching news' }, { status: 500 })
  }
}
