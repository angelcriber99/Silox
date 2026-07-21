import { NextResponse } from 'next/server'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import { mapSettledWithConcurrency } from '@/lib/utils/async'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { serverLogger } from '@/lib/server/logger'
import { getErrorMessage } from '@/lib/utils/errors'
import { authorizeCronRequest } from '@/lib/server/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request)
  const isClientSilentSync = request.headers.get('x-silent-sync') === 'true'

  if (!authorization.authorized && !isClientSilentSync) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    )
  }

  try {
    const yahooFinance = getYahooFinance()

    const supabase = getSupabaseAdmin()

    // Fetch all user assets
    const { data: activos, error: activosError } = await supabase
      .from('activos')
      .select('id, ticker, user_id, moneda, tipo')

    if (activosError) throw activosError
    if (!activos || activos.length === 0) {
      return NextResponse.json({ message: 'No assets found' })
    }

    // Fetch all transactions to compute holdings and check if dividend exists
    const { data: transacciones, error: txError } = await supabase
      .from('transacciones')
      .select('id, activo_id, tipo_operacion, cantidad, fecha, user_id')
      .order('fecha', { ascending: true })

    if (txError) throw txError

    const transactionsByHolding = new Map<string, typeof transacciones>()
    const registeredDividends = new Set<string>()

    for (const transaction of transacciones ?? []) {
      const holdingKey = `${transaction.user_id}:${transaction.activo_id}`
      const holdingTransactions = transactionsByHolding.get(holdingKey) ?? []
      holdingTransactions.push(transaction)
      transactionsByHolding.set(holdingKey, holdingTransactions)

      if (transaction.tipo_operacion === 'Dividendo') {
        registeredDividends.add(`${holdingKey}:${transaction.fecha.slice(0, 10)}`)
      }
    }

    // Helper: Find shares owned of an asset on or before a given date
    const getSharesAtDate = (activoId: string, userId: string, date: Date) => {
      let shares = 0
      const holdingKey = `${userId}:${activoId}`
      const divDateStr = date.toISOString().split('T')[0]
      for (const tx of transactionsByHolding.get(holdingKey) ?? []) {
        // Ex-dividend date rule: you must hold the asset BEFORE the ex-div date. 
        // Transactions ON or AFTER the ex-div date do not affect eligibility.
        if (tx.fecha >= divDateStr) break
        if (tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') {
          shares += tx.cantidad
        }
        if (tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida' || tx.tipo_operacion === 'Retirada') {
          shares -= tx.cantidad
        }
      }
      return shares
    }

    // Helper: Check if dividend is already registered
    const hasDividend = (activoId: string, userId: string, date: Date) => {
      const dString = date.toISOString().split('T')[0]
      return registeredDividends.has(`${userId}:${activoId}:${dString}`)
    }

    // 3. Unique tickers (only for stocks, ETFs, etc.)
    const uniqueTickers = Array.from(new Set(
      activos
        .filter(a => a.ticker !== 'CASH' && a.tipo !== 'Liquidez' && a.tipo !== 'Crypto')
        .map(a => a.ticker)
    ))

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90) // Look back 90 days for ADRs and delayed payments

    const addedDividends: Array<{
      ticker: string
      user_id: string
      amount: number
      date: Date
    }> = []

    // 4. Fetch Yahoo data with bounded concurrency, then write sequentially.
    const dividendResults = await mapSettledWithConcurrency(
      uniqueTickers,
      6,
      async (baseTicker) => {
        const tickerToCheck = baseTicker.includes('.') ? baseTicker.split('.')[0] : baseTicker
        try {
          const historicalDivs = await yahooFinance.historical(tickerToCheck, {
            period1: startDate,
            events: 'dividends'
          })
          return { baseTicker, historicalDivs }
        } catch (error) {
          throw new Error(`Error fetching dividends for ${tickerToCheck}`, { cause: error })
        }
      },
    )

    for (const result of dividendResults) {
      if (result.status === 'rejected') {
        serverLogger.warn('dividends.history.failed', {}, result.reason)
        continue
      }

      const { baseTicker, historicalDivs } = result.value

      if (!historicalDivs || historicalDivs.length === 0) continue

      // For every dividend event found
      for (const divEvent of historicalDivs) {
        if (!divEvent.date || !divEvent.dividends) continue

        const divDate = new Date(divEvent.date)
        const divAmountPerShare = divEvent.dividends

        // Find all users who own this ticker
        const holders = activos.filter(a => a.ticker === baseTicker)

        for (const activo of holders) {
          const shares = getSharesAtDate(activo.id, activo.user_id, divDate)

          if (shares > 0 && !hasDividend(activo.id, activo.user_id, divDate)) {
            const gross = shares * divAmountPerShare
            
            // Tax logic: US stocks -> 15% origen, 19% destino
            // EU stocks -> 0% origen, 19% destino
            const isUSD = activo.moneda === 'USD'
            const retencionOrigen = isUSD ? gross * 0.15 : 0
            const retencionDestino = gross * 0.19 // Spain tax on gross

            const { error: insertError } = await supabase
              .from('transacciones')
              .insert({
                user_id: activo.user_id,
                activo_id: activo.id,
                tipo_operacion: 'Dividendo',
                cantidad: shares,
                precio_unitario: divAmountPerShare,
                retencion_origen: Number(retencionOrigen.toFixed(2)),
                retencion_destino: Number(retencionDestino.toFixed(2)),
                fecha: divDate.toISOString().split('T')[0],
                estado: 'Completada',
                notas: 'Autocalculado por Silox (Sincronización Cron)'
              })

            if (insertError) {
              serverLogger.warn('dividends.insert.failed', { assetId: activo.id }, insertError)
            } else {
              registeredDividends.add(`${activo.user_id}:${activo.id}:${divDate.toISOString().split('T')[0]}`)
              
              addedDividends.push({
                ticker: baseTicker,
                user_id: activo.user_id,
                amount: gross,
                date: divDate
              })
            }
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Sync complete',
      dividendsAdded: addedDividends.length,
    })

  } catch (error: unknown) {
    serverLogger.error('dividends.cron.failed', error)
    const message = getErrorMessage(error, 'Unknown dividend cron error')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
