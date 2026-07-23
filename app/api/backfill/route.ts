import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import { mapSettledWithConcurrency } from '@/lib/utils/async'
import type { Database } from '@/lib/database.types'
import { serverLogger } from '@/lib/server/logger'
import { getErrorMessage } from '@/lib/utils/errors'

type HistoricalPoint = {
  date: Date
  close?: number | null
}

type HistorySnapshotInsert = Database['public']['Tables']['portfolio_history']['Insert']

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const yahooFinance = getYahooFinance()
    // 1. Obtener transacciones y activos
    const { data: transacciones, error: transactionsError } = await supabase
      .from('transacciones')
      .select('*, activo:activos(ticker, moneda)')
      .eq('estado', 'Completada')
      .order('fecha', { ascending: true })

    if (transactionsError) throw transactionsError

    if (!transacciones || transacciones.length === 0) {
      return NextResponse.json({ error: 'No hay transacciones' })
    }

    const { data: activos, error: assetsError } = await supabase.from('activos').select('*')
    if (assetsError) throw assetsError
    if (!activos) return NextResponse.json({ error: 'No hay activos' })

    // 2. Obtener fechas de los últimos 7 días
    const dates: Date[] = []
    const today = new Date()
    for (let i = 1; i <= 7; i++) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      d.setHours(23, 59, 59, 999)
      dates.push(d)
    }

    // Pedimos datos desde hace 14 días para asegurar que tenemos precios incluso con fines de semana
    const period1 = new Date()
    period1.setDate(today.getDate() - 14)
    // 3. Fetch historial de precios y divisas
    const tickers = Array.from(new Set(
      activos.filter((asset) => asset.ticker !== 'CASH').map((asset) => asset.ticker),
    ))
    const historicalData: Record<string, HistoricalPoint[]> = {}
    
    // Añadir EURUSD=X si hay activos en USD
    const hasUsd = activos.some(a => a.moneda === 'USD')
    if (hasUsd && !tickers.includes('EURUSD=X')) {
      tickers.push('EURUSD=X')
    }

    const historyResults = await mapSettledWithConcurrency(
      tickers,
      6,
      async (ticker) => {
        const result = await yahooFinance.chart(ticker, { period1: period1, interval: '1d' })
        return { ticker, quotes: result.quotes || [] }
      },
    )

    historyResults.forEach((result, index) => {
      const ticker = tickers[index]
      if (result.status === 'fulfilled') {
        historicalData[ticker] = result.value.quotes
      } else {
        serverLogger.warn('portfolio.backfill.quote.failed', { ticker }, result.reason)
        historicalData[ticker] = []
      }
    })

    const snapshotsToInsert: HistorySnapshotInsert[] = []

    // 4. Reconstruir portfolio por cada día
    for (const targetDate of dates) {
      // Formato YYYY-MM-DD usando offset local
      const year = targetDate.getFullYear()
      const month = String(targetDate.getMonth() + 1).padStart(2, '0')
      const day = String(targetDate.getDate()).padStart(2, '0')
      const targetDateStr = `${year}-${month}-${day}`
      
      let total_invested = 0
      let total_value = 0

      // Reconstruir posiciones en ese día
      const positionsMap = new Map<string, { unidades: number, coste_eur: number, moneda: string, ticker: string }>()

      for (const t of transacciones) {
        const tDate = new Date(t.fecha)
        if (tDate <= targetDate) {
          const key = t.activo_id
          const current = positionsMap.get(key) || { 
            unidades: 0, 
            coste_eur: 0, 
            moneda: t.activo.moneda,
            ticker: t.activo.ticker,
          }

          let txUsdToEurRate = 1
          if (hasUsd && current.moneda === 'USD') {
            const eurUsdHistory = historicalData['EURUSD=X'] || []
            const ratePoint = eurUsdHistory.slice().reverse().find(p => new Date(p.date) <= tDate)
            if (ratePoint?.close && ratePoint.close > 0) {
              txUsdToEurRate = 1 / ratePoint.close
            }
          }

          if (t.tipo_operacion === 'Compra' || t.tipo_operacion === 'Traspaso Entrada') {
            current.unidades += t.cantidad
            const costeTxUsd = (t.cantidad * t.precio_unitario) + t.comision
            current.coste_eur += costeTxUsd * txUsdToEurRate
          } else if (
            t.tipo_operacion === 'Venta' ||
            t.tipo_operacion === 'Traspaso Salida' ||
            t.tipo_operacion === 'Retirada'
          ) {
            // Venta resta el valor total de la venta del coste (para mantener realized PNL)
            const valorVentaUsd = (t.cantidad * t.precio_unitario) - (t.comision || 0)
            current.unidades -= t.cantidad
            current.coste_eur -= valorVentaUsd * txUsdToEurRate
          }
          positionsMap.set(key, current)
        }
      }

      // Obtener el tipo de cambio para ese día (buscar el más reciente <= targetDate)
      let usdToEurRate = 1
      if (hasUsd) {
        const eurUsdHistory = historicalData['EURUSD=X'] || []
        const ratePoint = eurUsdHistory.slice().reverse().find(p => new Date(p.date) <= targetDate)
        if (ratePoint?.close && ratePoint.close > 0) {
          usdToEurRate = 1 / ratePoint.close // EURUSD=X es 1 EUR = X USD, así que 1 USD = 1/X EUR
        }
      }

      // Calcular valor de las posiciones ese día
      for (const pos of positionsMap.values()) {
        total_invested += pos.coste_eur

        if (pos.unidades <= 0) continue

        const history = historicalData[pos.ticker] || []
        // Buscar el precio de cierre más cercano <= targetDate
        const pricePoint = history.slice().reverse().find(p => new Date(p.date) <= targetDate)
        
        let valueInEur = 0;
        
        if (pos.ticker === 'CASH' || pos.ticker === 'REVOLUT') {
          valueInEur = pos.unidades * (pos.moneda === 'USD' ? usdToEurRate : 1)
        } else if (pricePoint && pricePoint.close > 0) {
          valueInEur = pos.unidades * pricePoint.close * (pos.moneda === 'USD' ? usdToEurRate : 1)
        } else {
          // Si no hay datos históricos para este día, usamos el coste acumulado para evitar que caiga a 0 (picos rojos)
          valueInEur = pos.coste_eur
        }

        total_value += valueInEur
      }

      // Solo insertar si hay algo en el portfolio
      if (total_invested > 0 || total_value > 0) {
        snapshotsToInsert.push({
          user_id: user.id,
          timestamp: targetDateStr + 'T12:00:00Z',
          total_value: total_value,
          total_invested: total_invested
        })
      }
    }

    // 5. Replace only the deterministic daily points generated by this backfill.
    if (snapshotsToInsert.length > 0) {
      const timestamps = snapshotsToInsert.flatMap((snapshot) => snapshot.timestamp ? [snapshot.timestamp] : [])
      const { error: deleteError } = await supabase
        .from('portfolio_history')
        .delete()
        .eq('user_id', user.id)
        .in('timestamp', timestamps)

      if (deleteError) throw deleteError

      const { error: insertError } = await supabase
        .from('portfolio_history')
        .insert(snapshotsToInsert)

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Se han reconstruido ${snapshotsToInsert.length} días de historial.`,
      snapshots: snapshotsToInsert
    })

  } catch (error: unknown) {
    serverLogger.error('portfolio.backfill.failed', error, { userId: user.id })
    const message = getErrorMessage(error, 'Error reconstruyendo el historial')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
