const { createClient } = require('@supabase/supabase-js')
const yahooFinance = require('yahoo-finance2').default
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function getHistoricalFx(dateStr, from, to) {
  if (from === to) return 1
  const ticker = `${from}${to}=X`
  try {
    const d = new Date(dateStr)
    const dBefore = new Date(d.getTime() - 5 * 24 * 60 * 60 * 1000)
    const dAfter = new Date(d.getTime() + 2 * 24 * 60 * 60 * 1000)
    const result = await yahooFinance.historical(ticker, {
      period1: dBefore.toISOString().split('T')[0],
      period2: dAfter.toISOString().split('T')[0],
    })
    
    if (!result || result.length === 0) return null
    
    let closest = result[0]
    let minDiff = Infinity
    const targetTime = d.getTime()
    
    for (const r of result) {
      const diff = Math.abs(r.date.getTime() - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        closest = r
      }
    }
    return closest.close
  } catch (err) {
    console.error(`Error fetching FX for ${ticker} on ${dateStr}:`, err.message)
    return null
  }
}

async function run() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === 'angelcriber99@gmail.com')
  if (!user) return console.error('User not found')

  const { data: activos } = await supabase.from('activos').select('*').eq('user_id', user.id)
  const { data: txs } = await supabase.from('transacciones').select('*').eq('user_id', user.id).order('fecha', { ascending: true })

  console.log('--- AUDIT REPORT ---\n')

  let totalPortfolioInvestedEur = 0

  for (const activo of activos) {
    const assetTxs = txs.filter(t => t.activo_id === activo.id && t.estado === 'Completada')
    if (assetTxs.length === 0) continue

    let units = 0
    let totalCostNative = 0
    let totalCostEur = 0

    const lots = []

    for (const tx of assetTxs) {
      const isBuy = tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada'
      const isSell = tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida'

      if (isBuy) {
        units += tx.cantidad
        const costNative = (tx.cantidad * tx.precio_unitario) + (tx.comision || 0)
        totalCostNative += costNative
        
        let fxRate = 1
        if (activo.moneda !== 'EUR') {
          if (tx.tipo_cambio_eur) {
            fxRate = tx.tipo_cambio_eur
            console.log(`[DEBUG] From DB FX for ${tx.fecha} ${activo.moneda}->EUR = ${fxRate}`)
          } else {
            const fetched = await getHistoricalFx(tx.fecha, activo.moneda, 'EUR')
            if (fetched) fxRate = fetched
            console.log(`[DEBUG] Fetched FX for ${tx.fecha} ${activo.moneda}->EUR = ${fxRate}`)
          }
        }
        
        const costEur = costNative * fxRate
        totalCostEur += costEur
        
        lots.push({
          qty: tx.cantidad,
          price: tx.precio_unitario,
          fxRate,
          costNative,
          costEur
        })
      } else if (isSell) {
        units -= tx.cantidad
        let qtyToSell = tx.cantidad
        while (qtyToSell > 0.000001 && lots.length > 0) {
          const lot = lots[0]
          const sellQty = Math.min(qtyToSell, lot.qty)
          lot.qty -= sellQty
          qtyToSell -= sellQty
          
          const portion = sellQty / (lot.qty + sellQty)
          const soldNative = lot.costNative * portion
          const soldEur = lot.costEur * portion
          
          totalCostNative -= soldNative
          totalCostEur -= soldEur
          
          lot.costNative -= soldNative
          lot.costEur -= soldEur
          
          if (lot.qty <= 0.000001) lots.shift()
        }
      }
    }

    if (units > 0.000001) {
      const avgPriceNative = totalCostNative / units
      console.log(`[${activo.ticker}] ${activo.nombre}`)
      console.log(`  Units: ${units.toFixed(6)}`)
      console.log(`  Avg Price: ${avgPriceNative.toFixed(2)} ${activo.moneda}`)
      console.log(`  Invested (Native): ${totalCostNative.toFixed(2)} ${activo.moneda}`)
      console.log(`  Invested (EUR, historical FX): ${totalCostEur.toFixed(2)} EUR\n`)
      totalPortfolioInvestedEur += totalCostEur
    }
  }

  console.log(`TOTAL PORTFOLIO INVESTED (EUR FIFO): ${totalPortfolioInvestedEur.toFixed(2)} €`)
}

run()
