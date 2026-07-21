import { getSupabaseAdmin } from '../lib/supabase/admin'
import { getYahooFinance } from '../lib/server/yahoo-finance'
import { config } from 'dotenv'

config({ path: '../.env.local' })

async function main() {
  console.log("Starting diagnostic...")
  const supabase = getSupabaseAdmin()
  const yahooFinance = getYahooFinance()

  const { data: activos } = await supabase.from('activos').select('*').eq('ticker', 'BABA')
  if (!activos || activos.length === 0) {
    console.log("User does not have BABA in their DB.");
    return;
  }
  
  const activo = activos[0]
  console.log("Activo BABA found for user", activo.user_id)
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 90)

  console.log("Fetching Yahoo Finance for BABA since", startDate.toISOString())
  const historicalDivs = await yahooFinance.historical('BABA', {
    period1: startDate,
    events: 'dividends'
  })
  
  console.log("Yahoo Finance Dividends:", JSON.stringify(historicalDivs, null, 2))
  
  const { data: txs } = await supabase.from('transacciones').select('*').eq('activo_id', activo.id).order('fecha', { ascending: true })
  console.log("Transactions for BABA:")
  txs?.forEach(tx => console.log(`- ${tx.fecha}: ${tx.tipo_operacion} ${tx.cantidad} shares`))
  
  // Simulate getSharesAtDate
  for (const divEvent of historicalDivs || []) {
    const divDate = new Date(divEvent.date)
    const divDateStr = divDate.toISOString().split('T')[0]
    let shares = 0
    for (const tx of txs ?? []) {
      if (tx.fecha >= divDateStr) break
      if (tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') {
        shares += tx.cantidad
      }
      if (tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida' || tx.tipo_operacion === 'Retirada') {
        shares -= tx.cantidad
      }
    }
    console.log(`Shares held before ${divDateStr} (ex-div): ${shares}`)
  }
}
main();
