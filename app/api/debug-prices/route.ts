import { NextResponse } from 'next/server'
import { fetchMarketPricesDirect } from '@/lib/actions/market'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker') || 'NVO'
  
  const data = await fetchMarketPricesDirect([ticker], false)
  return NextResponse.json(data)
}
