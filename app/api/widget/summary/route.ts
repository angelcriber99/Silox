import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enrichPositions, computePortfolioTotals } from '@/lib/api/assets'

// We need an absolute URL for internal fetch if fetchPrices uses API routes
// However, fetchPrices from lib/api/market calls /api/market-data
// Since we are on the server, we might need to bypass the fetch to our own API
// Let's import the server function directly if possible, or use absolute URL
import { fetchMarketPrices } from '@/lib/actions/market'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    // Create a Supabase client that uses this specific JWT
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    )

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token or user not found' }, { status: 401 })
    }

    // Fetch positions
    const { data: rawPositions, error: posError } = await supabase
      .from('posiciones')
      .select('*')

    if (posError) {
      throw new Error(`Error fetching positions: ${posError.message}`)
    }

    const filteredPositions = (rawPositions || []).filter(
      p => p.tipo !== 'Fondo Monetario' && p.tipo !== 'Liquidez' && p.ticker !== 'CASH' && Math.abs(p.unidades) > 0.000001
    )

    const tickers = filteredPositions.map(p => p.ticker)

    // Fetch prices using the server function
    let pricePayload = {}
    if (tickers.length > 0) {
      pricePayload = await fetchMarketPrices(tickers, true) // true = convert to EUR
    }

    // Enrich positions
    const enriched = enrichPositions(rawPositions || [], pricePayload)
    const confirmedPositions = enriched.filter(p => p.tipo !== 'Fondo Monetario' && p.tipo !== 'Liquidez')
    
    // Compute totals
    const totals = computePortfolioTotals(enriched)

    // Find top volatile assets
    const sortedMovers = [...confirmedPositions]
      .filter(p => p.change_percent_24h !== null && p.precio_actual !== null)
      .sort((a, b) => Math.abs(b.change_percent_24h || 0) - Math.abs(a.change_percent_24h || 0))

    const topVolatile = sortedMovers.slice(0, 2).map(p => ({
      ticker: p.ticker,
      name: p.nombre,
      changePercent: p.change_percent_24h,
      isPositive: (p.change_percent_24h || 0) >= 0
    }))

    // Construct response
    const netSession = totals.changeAmount24h

    return NextResponse.json({
      netSession: netSession,
      totalValue: totals.currentValue,
      volatileAssets: topVolatile,
      updatedAt: new Date().toISOString()
    })

  } catch (err: any) {
    console.error('Widget API Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
