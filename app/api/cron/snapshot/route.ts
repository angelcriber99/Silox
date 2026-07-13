import { NextResponse } from 'next/server'
import { computePortfolioTotals, enrichPositions } from '@/lib/api/assets'
import { authorizeCronRequest } from '@/lib/server/cron-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { fetchMarketPrices } from '@/lib/actions/market'

export const revalidate = 0

export async function GET(request: Request) {
  try {
    const authorization = authorizeCronRequest(request)
    if (!authorization.authorized) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (usersError || !users) {
      throw new Error(`Failed to fetch users: ${usersError?.message}`)
    }

    const { data: allPositions, error: positionsError } = await supabaseAdmin
      .from('posiciones')
      .select('*')

    if (positionsError) throw positionsError

    const tickers = Array.from(new Set(
      (allPositions ?? [])
        .filter((position) => position.unidades > 0)
        .map((position) => position.ticker),
    ))
    const pricePayload = tickers.length > 0
      ? await fetchMarketPrices(tickers, true)
      : { prices: {}, fxRates: {} }

    let snapshotsSaved = 0

    for (const user of users.users) {
      const positions = (allPositions ?? []).filter(
        (position) => position.user_id === user.id,
      )
      if (positions.length === 0) continue

      const enriched = enrichPositions(positions, pricePayload)
      const totals = computePortfolioTotals(enriched)

      if (totals.totalValue > 0) {
        // Get the last snapshot to prevent saving identical data (0 PnL instante)
        const { data: lastSnapshot } = await supabaseAdmin
          .from('portfolio_history')
          .select('total_value')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single()

        // If the value is exactly the same (less than 1 cent difference), skip it
        if (lastSnapshot && Math.abs(lastSnapshot.total_value - totals.totalValue) < 0.01) {
          continue
        }

        const { error: insertError } = await supabaseAdmin
          .from('portfolio_history')
          .insert({
            user_id: user.id,
            total_value: totals.totalValue,
            total_invested: totals.totalCost,
          })
          
        if (!insertError) {
          snapshotsSaved++
        } else {
          console.error(`Error inserting history for user ${user.id}:`, insertError)
        }
      }
    }

    return NextResponse.json({ success: true, snapshotsSaved })
  } catch (error: unknown) {
    console.error('Cron Snapshot Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown snapshot error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
