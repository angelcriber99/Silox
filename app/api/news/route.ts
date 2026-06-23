import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
  }

  try {
    const result = await YahooFinance.search(ticker, { newsCount: 10 })
    return NextResponse.json({ news: (result as any).news || [] })
  } catch (error) {
    console.error('Error fetching news:', error)
    return NextResponse.json({ error: 'Error fetching news' }, { status: 500 })
  }
}
