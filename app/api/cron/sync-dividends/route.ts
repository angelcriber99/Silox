import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Check authorization (Vercel Cron Secret)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Opcional: Descomentar para forzar seguridad estricta del cron
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch all user assets
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

    // Helper: Find shares owned of an asset on or before a given date
    const getSharesAtDate = (activoId: string, userId: string, date: Date) => {
      let shares = 0
      for (const tx of transacciones || []) {
        if (tx.activo_id === activoId && tx.user_id === userId) {
          const txDate = new Date(tx.fecha)
          if (txDate <= date) {
            if (tx.tipo_operacion === 'Compra') shares += tx.cantidad
            if (tx.tipo_operacion === 'Venta') shares -= tx.cantidad
          }
        }
      }
      return shares
    }

    // Helper: Check if dividend is already registered
    const hasDividend = (activoId: string, userId: string, date: Date) => {
      const dString = date.toISOString().split('T')[0]
      for (const tx of transacciones || []) {
        if (
          tx.activo_id === activoId &&
          tx.user_id === userId &&
          tx.tipo_operacion === 'Dividendo' &&
          tx.fecha.startsWith(dString)
        ) {
          return true
        }
      }
      return false
    }

    // 3. Unique tickers (only for stocks, ETFs, etc.)
    const uniqueTickers = Array.from(new Set(
      activos
        .filter(a => a.tipo !== 'Liquidez' && a.tipo !== 'Crypto')
        .map(a => a.ticker)
    ))

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30) // Look back 30 days

    const addedDividends: any[] = []

    // 4. Check each ticker for recent dividends
    for (const baseTicker of uniqueTickers) {
      const tickerToCheck = baseTicker.includes('.') ? baseTicker.split('.')[0] : baseTicker

      let historicalDivs: any[] = []
      try {
        historicalDivs = await yahooFinance.historical(tickerToCheck, {
          period1: startDate,
          events: 'div'
        })
      } catch (err) {
        console.error(`Error fetching historical dividends for ${tickerToCheck}:`, err)
      }

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
              console.error(`Error inserting dividend for ${activo.id}:`, insertError)
            } else {
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
      details: addedDividends
    })

  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
