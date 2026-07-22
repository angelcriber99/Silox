import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { enrichPositions, computePortfolioTotals } from '@/lib/api/assets'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { hashWidgetToken, isOpaqueWidgetToken } from '@/lib/server/widget-tokens'
import type { Database } from '@/lib/database.types'

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

    const token = authHeader.split(' ')[1].trim()

    let targetUserId: string
    let supabase: SupabaseClient<Database>

    if (isOpaqueWidgetToken(token)) {
      const tokenHash = hashWidgetToken(token)
      const supabaseAdmin = getSupabaseAdmin()
      const { data: widgetCredential, error: credentialError } = await supabaseAdmin
        .from('widget_access_tokens')
        .select('user_id')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .maybeSingle()

      if (credentialError) throw credentialError
      if (!widgetCredential) {
        return NextResponse.json({ error: 'Invalid widget token' }, { status: 401 })
      }

      targetUserId = widgetCredential.user_id
      supabase = supabaseAdmin

      const { error: usageError } = await supabaseAdmin
        .from('widget_access_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)

      if (usageError) throw usageError
    } else {
      // Standard JWT Auth (from Web App)
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` }
          }
        }
      )
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return NextResponse.json({ error: 'Invalid token or user not found' }, { status: 401 })
      }
      targetUserId = user.id
    }

    // Fetch positions
    const { data: rawPositionsData, error: posError } = await supabase
      .from('posiciones')
      .select('*')
      .eq('user_id', targetUserId)

    if (posError) {
      throw new Error(`Error fetching positions: ${posError.message}`)
    }

    const rawPositions = rawPositionsData ?? []

    const filteredPositions = rawPositions.filter(
      (position) => position.tipo !== 'Fondo Monetario'
        && position.tipo !== 'Liquidez'
        && position.ticker !== 'CASH'
        && Math.abs(position.unidades) > 0.000001
    )

    const tickers = filteredPositions.map((position) => position.ticker)

    const pricePayload = tickers.length > 0
      ? await fetchMarketPrices(tickers, true)
      : { prices: {} }

    // Enrich positions
    const enriched = enrichPositions(filteredPositions, pricePayload)
    const confirmedPositions = enriched.filter(p => p.tipo !== 'Fondo Monetario' && p.tipo !== 'Liquidez')
    
    // Compute totals
    const totals = computePortfolioTotals(enriched)

    // Find top volatile assets
    const sortedMovers = [...confirmedPositions]
      .filter((position) => position.change_percent_24h !== null && position.precio_actual !== null)
      .sort((a, b) => Math.abs(b.change_percent_24h || 0) - Math.abs(a.change_percent_24h || 0))

    const topVolatile = sortedMovers.slice(0, 2).map((position) => ({
      ticker: position.ticker,
      name: position.nombre,
      changePercent: position.change_percent_24h,
      isPositive: (position.change_percent_24h || 0) >= 0
    }))

    // Construct response
    const netSession = totals.pnl24hMoney.amount

    return NextResponse.json({
      netSession: netSession,
      totalValue: totals.valueMoney.amount,
      volatileAssets: topVolatile,
      updatedAt: new Date().toISOString()
    })

  } catch (err: unknown) {
    console.error('Widget API Error:', err, (err as Error).stack)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
