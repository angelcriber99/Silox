import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computePortfolioTotals, enrichPositions } from '@/lib/api/assets'
import { calculateNetInvestmentByCurrency, convertNetInvestmentToEur } from '@/lib/domain/portfolio/contributions'
import { isInvestablePortfolioAsset } from '@/lib/domain/assets/normalization'
import { fetchMarketPrices } from '@/lib/actions/market'

export const revalidate = 0

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false } }
    )

    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (usersError || !users) {
      throw new Error(`Failed to fetch users: ${usersError?.message}`)
    }

    let snapshotsSaved = 0

    for (const user of users.users) {
      const { data: positions } = await supabaseAdmin
        .from('posiciones')
        .select('*')
        .eq('user_id', user.id)

      if (!positions || positions.length === 0) continue

      const { data: pendingTxs } = await supabaseAdmin
        .from('transacciones')
        .select('*, activo:posiciones(*)')
        .eq('user_id', user.id)
        .eq('estado', 'PENDIENTE')

      const adjustedPositions = positions.map(pos => {
        const posPending = pendingTxs?.filter(tx => tx.activo?.ticker === pos.ticker) || []
        let newUnidades = pos.unidades
        let newCoste = pos.coste_total
        
        for (const tx of posPending) {
          if (tx.tipo_operacion === 'Compra') {
            newUnidades -= tx.cantidad
            newCoste -= (tx.cantidad * tx.precio_unitario)
          } else if (tx.tipo_operacion === 'Venta') {
            newUnidades += tx.cantidad
            newCoste += (tx.cantidad * tx.precio_unitario)
          }
        }
        return { ...pos, unidades: newUnidades, coste_total: newCoste }
      })

      const visiblePositions = adjustedPositions.filter(isInvestablePortfolioAsset)
      const tickers = visiblePositions
        .filter((p) => p.unidades > 0)
        .map((p) => p.ticker)
      if (tickers.length === 0) continue

      let pricePayload
      try {
        pricePayload = await fetchMarketPrices(tickers, true)
      } catch (e) {
        console.error(`Error fetching prices for user ${user.id}:`, e)
        continue
      }

      const enriched = enrichPositions(visiblePositions, pricePayload)
      const { data: fundingTransactions } = await supabaseAdmin
        .from('transacciones')
        .select('tipo_operacion, cantidad, precio_unitario, comision, retencion_origen, retencion_destino, notas, activo:activos(ticker, tipo, moneda)')
        .eq('user_id', user.id)
        .eq('estado', 'Completada')
      const funding = calculateNetInvestmentByCurrency(fundingTransactions ?? [])
      const netContributions = convertNetInvestmentToEur(funding, pricePayload.fxRates)
      const totals = computePortfolioTotals(enriched, netContributions)

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
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unexpected snapshot error',
    }, { status: 500 })
  }
}
