import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const userId = '64ae224e-553d-43c4-96c3-fbdff014d693' // from previous logs

async function run() {
  try {
    const { data: transacciones } = await supabase
      .from('transacciones')
      .select('*, activo:activos(ticker, moneda)')
      .eq('user_id', userId)
      .order('fecha', { ascending: true })

    const { data: activos } = await supabase.from('activos').select('*').eq('user_id', userId)

    const dates = []
    const today = new Date()
    for (let i = 1; i <= 7; i++) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      d.setHours(0, 0, 0, 0)
      dates.push(d)
    }

    const period1 = new Date()
    period1.setDate(today.getDate() - 14)

    const tickers = Array.from(new Set(activos.map(a => a.ticker)))
    const historicalData = {}
    
    const hasUsd = activos.some(a => a.moneda === 'USD')
    if (hasUsd && !tickers.includes('EURUSD=X')) tickers.push('EURUSD=X')

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

    for (const targetDate of dates) {
      const year = targetDate.getFullYear()
      const month = String(targetDate.getMonth() + 1).padStart(2, '0')
      const day = String(targetDate.getDate()).padStart(2, '0')
      const targetDateStr = `${year}-${month}-${day}`
      let total_invested = 0
      let total_value = 0
      const positionsMap = new Map()

      for (const t of transacciones) {
        const tDate = new Date(t.fecha)
        if (tDate <= targetDate) {
          const key = t.activo_id
          const current = positionsMap.get(key) || { 
            unidades: 0, coste_eur: 0, moneda: t.activo.moneda, ticker: t.activo.ticker
          }

          let txUsdToEurRate = 1
          if (hasUsd && current.moneda === 'USD') {
            const eurUsdHistory = historicalData['EURUSD=X'] || []
            const ratePoint = eurUsdHistory.slice().reverse().find(p => new Date(p.date) <= tDate)
            if (ratePoint) txUsdToEurRate = 1 / ratePoint.close
          }

          if (t.tipo_operacion === 'Compra') {
            current.unidades += t.cantidad
            const costeTxUsd = (t.cantidad * t.precio_unitario) + t.comision
            current.coste_eur += costeTxUsd * txUsdToEurRate
          } else {
            const valorVentaUsd = (t.cantidad * t.precio_unitario) - (t.comision || 0)
            current.unidades -= t.cantidad
            current.coste_eur -= valorVentaUsd * txUsdToEurRate
          }
          positionsMap.set(key, current)
        }
      }

      let usdToEurRate = 1
      if (hasUsd) {
        const eurUsdHistory = historicalData['EURUSD=X'] || []
        const ratePoint = eurUsdHistory.slice().reverse().find(p => new Date(p.date) <= targetDate)
        if (ratePoint) usdToEurRate = 1 / ratePoint.close
      }

      for (const [activo_id, pos] of positionsMap.entries()) {
        total_invested += pos.coste_eur
        if (pos.unidades <= 0) continue

        const history = historicalData[pos.ticker] || []
        const pricePoint = history.slice().reverse().find(p => new Date(p.date) <= targetDate)
        let price = pricePoint ? pricePoint.close : 0

        if (pos.ticker === 'REVOLUT') {
          price = 1
        }

        let valueInEur = pos.unidades * price
        if (pos.moneda === 'USD') valueInEur = valueInEur * usdToEurRate

        total_value += valueInEur
      }

      if (total_invested > 0 || total_value > 0) {
        snapshotsToInsert.push({
          user_id: userId,
          date: targetDateStr,
          total_value,
          total_invested,
          updated_at: new Date().toISOString()
        })
      }
    }

    if (snapshotsToInsert.length > 0) {
      console.log('Inserting:', snapshotsToInsert);
      const { error: upsertError } = await supabase.from('portfolio_snapshots').upsert(snapshotsToInsert, { onConflict: 'user_id,date' })
      if (upsertError) console.error(upsertError)
      else console.log('Success!')
    }
  } catch (err) {
    console.error(err)
  }
}
run()
