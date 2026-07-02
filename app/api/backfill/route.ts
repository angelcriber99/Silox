import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // 1. Obtener transacciones y activos
    const { data: transacciones } = await supabase
      .from('transacciones')
      .select('*, activo:activos(ticker, moneda)')
      .order('fecha', { ascending: true })

    if (!transacciones || transacciones.length === 0) {
      return NextResponse.json({ error: 'No hay transacciones' })
    }

    const { data: activos } = await supabase.from('activos').select('*')
    if (!activos) return NextResponse.json({ error: 'No hay activos' })

    // 2. Obtener fechas de los últimos 7 días
    const dates: Date[] = []
    const today = new Date()
    for (let i = 1; i <= 7; i++) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      d.setHours(0, 0, 0, 0)
      dates.push(d)
    }

    // Pedimos datos desde hace 14 días para asegurar que tenemos precios incluso con fines de semana
    const period1 = new Date()
    period1.setDate(today.getDate() - 14)
    const period1Str = period1.toISOString().split('T')[0]

    // 3. Fetch historial de precios y divisas
    const tickers = Array.from(new Set(activos.map(a => a.ticker)))
    const historicalData: Record<string, any[]> = {}
    
    // Añadir EURUSD=X si hay activos en USD
    const hasUsd = activos.some(a => a.moneda === 'USD')
    if (hasUsd && !tickers.includes('EURUSD=X')) {
      tickers.push('EURUSD=X')
    }

    for (const ticker of tickers) {
      try {
        const result = await yahooFinance.chart(ticker, { period1: period1, interval: '1d' })
        historicalData[ticker] = result.quotes || []
      } catch (e) {
        console.error(`Error fetching history for ${ticker}:`, e)
        historicalData[ticker] = []
      }
    }

    const snapshotsToInsert = []

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
            moneda: (t.activo as any).moneda,
            ticker: (t.activo as any).ticker
          }

          let txUsdToEurRate = 1
          if (hasUsd && current.moneda === 'USD') {
            const eurUsdHistory = historicalData['EURUSD=X'] || []
            const ratePoint = eurUsdHistory.slice().reverse().find(p => new Date(p.date) <= tDate)
            if (ratePoint) {
              txUsdToEurRate = 1 / ratePoint.close
            }
          }

          if (t.tipo_operacion === 'Compra') {
            current.unidades += t.cantidad
            const costeTxUsd = (t.cantidad * t.precio_unitario) + t.comision
            current.coste_eur += costeTxUsd * txUsdToEurRate
          } else {
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
        if (ratePoint) {
          usdToEurRate = 1 / ratePoint.close // EURUSD=X es 1 EUR = X USD, así que 1 USD = 1/X EUR
        }
      }

      // Calcular valor de las posiciones ese día
      for (const [activo_id, pos] of positionsMap.entries()) {
        total_invested += pos.coste_eur

        if (pos.unidades <= 0) continue

        const history = historicalData[pos.ticker] || []
        // Buscar el precio de cierre más cercano <= targetDate
        const pricePoint = history.slice().reverse().find(p => new Date(p.date) <= targetDate)
        let price = pricePoint ? pricePoint.close : 0
        
        // Mock para REVOLUT
        if (pos.ticker === 'REVOLUT') {
          price = 1
        }

        let valueInEur = pos.unidades * price
        if (pos.moneda === 'USD') {
          valueInEur = valueInEur * usdToEurRate
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

    // 5. Insert en la nueva base de datos
    if (snapshotsToInsert.length > 0) {
      // @ts-ignore
      const { error: upsertError } = await supabase
        .from('portfolio_history')
        .insert(snapshotsToInsert)

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Se han reconstruido ${snapshotsToInsert.length} días de historial.`,
      snapshots: snapshotsToInsert
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
