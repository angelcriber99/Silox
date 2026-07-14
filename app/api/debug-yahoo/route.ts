import { NextResponse } from 'next/server'
import { getYahooFinance } from '@/lib/server/yahoo-finance'

export const dynamic = 'force-dynamic'

export async function GET() {
  const quote = await getYahooFinance().quote('AAPL')
  return NextResponse.json(quote)
}
