import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computePortfolioTotals, enrichPositions } from '@/lib/api/assets'
import { calculateFixedNetInvestmentEur } from '@/lib/domain/portfolio/contributions'
import { applyHistoricalFxRates, missingHistoricalFxRequests } from '@/lib/domain/portfolio/historical-fx-hydration'
import { fetchHistoricalFxRates } from '@/lib/actions/historical-fx'
import { isInvestablePortfolioAsset } from '@/lib/domain/assets/normalization'
import { fetchMarketPrices } from '@/lib/actions/market'
import { applyPortfolioAccounting, calculatePortfolioAccounting, type PortfolioAccountingTransaction } from '@/lib/domain/portfolio/accounting-engine'
import { collectAllPages } from '@/lib/utils/pagination'

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

    const users = []
    for (let page = 1; ; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1_000 })
      if (error) throw new Error(`Failed to fetch users: ${error.message}`)
      users.push(...data.users)
      if (data.users.length < 1_000) break
    }

    let snapshotsSaved = 0
    let usersSkippedForReconciliation = 0

    for (const user of users) {
      const { data: positions } = await supabaseAdmin
        .from('posiciones')
        .select('*')
        .eq('user_id', user.id)

      if (!positions || positions.length === 0) continue

      const fundingTransactions = await collectAllPages((from, to) => supabaseAdmin
        .from('transacciones')
        .select('id, activo_id, tipo_operacion, cantidad, precio_unitario, comision, retencion_origen, retencion_destino, fecha, created_at, notas, estado, tipo_cambio_eur, activo:activos(ticker, tipo, moneda)')
        .eq('user_id', user.id)
        .eq('estado', 'Completada')
        .order('fecha', { ascending: true })
        .order('created_at', { ascending: true })
        .range(from, to))
      const ledgerTransactions = fundingTransactions as PortfolioAccountingTransaction[]
      const missingFxRequests = missingHistoricalFxRequests(ledgerTransactions)
      const historicalRates = await fetchHistoricalFxRates(missingFxRequests)
      const transactionsWithHistoricalFx = applyHistoricalFxRates(ledgerTransactions, historicalRates)
      const previousRatesByTransactionId = new Map(
        ledgerTransactions.map((transaction) => [transaction.id, transaction.tipo_cambio_eur]),
      )
      const accounting = calculatePortfolioAccounting(transactionsWithHistoricalFx)
      const projection = applyPortfolioAccounting(
        positions.filter(isInvestablePortfolioAsset),
        accounting,
      )
      if (projection.issues.length > 0) {
        usersSkippedForReconciliation += 1
        continue
      }

      const visiblePositions = projection.positions
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
      const idsByRate = new Map<number, string[]>()
      for (const transaction of transactionsWithHistoricalFx) {
        const previousRate = Number(previousRatesByTransactionId.get(transaction.id))
        const rate = Number(transaction.tipo_cambio_eur)
        if (Number.isFinite(previousRate) && previousRate > 0) continue
        if (!transaction.id || !Number.isFinite(rate) || rate <= 0) continue
        const ids = idsByRate.get(rate) ?? []
        ids.push(transaction.id)
        idsByRate.set(rate, ids)
      }
      await Promise.all(Array.from(idsByRate, ([rate, ids]) =>
        supabaseAdmin
          .from('transacciones')
          .update({ tipo_cambio_eur: rate })
          .in('id', ids)
          .eq('user_id', user.id)
          .is('tipo_cambio_eur', null)
      ))
      const funding = accounting.funding
      const netContributions = calculateFixedNetInvestmentEur(funding, historicalRates)
      const totals = computePortfolioTotals(enriched, netContributions)

      // Never persist an estimated portfolio. A temporary quote outage would
      // otherwise look like a real market loss in the historical chart.
      if (totals.valueMoney.amount > 0 && totals.hasAllPrices) {
        // Get the last snapshot to prevent saving identical data (0 PnL instante)
        const { data: lastSnapshot } = await supabaseAdmin
          .from('portfolio_history')
          .select('total_value, total_invested')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle()

        // If the value is exactly the same (less than 1 cent difference), skip it
        if (lastSnapshot
          && Math.abs(lastSnapshot.total_value - totals.valueMoney.amount) < 0.01
          && Math.abs(lastSnapshot.total_invested - totals.costMoney.amount) < 0.01) {
          continue
        }

        const { error: insertError } = await supabaseAdmin
          .from('portfolio_history')
          .insert({
            user_id: user.id,
            total_value: totals.valueMoney.amount,
            total_invested: totals.costMoney.amount,
          })
          
        if (!insertError) {
          snapshotsSaved++
        } else {
          console.error(`Error inserting history for user ${user.id}:`, insertError)
        }
      }
    }

    return NextResponse.json({ success: true, snapshotsSaved, usersSkippedForReconciliation })
  } catch (error: unknown) {
    console.error('Cron Snapshot Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unexpected snapshot error',
    }, { status: 500 })
  }
}
