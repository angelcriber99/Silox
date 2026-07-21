import { getSupabaseAdmin } from '../lib/supabase/admin'
import { getYahooFinance } from '../lib/server/yahoo-finance'
import { config } from 'dotenv'

config({ path: '../.env.local' })

async function main() {
  const supabase = getSupabaseAdmin()
  const yahooFinance = getYahooFinance()

  const { data: activos } = await supabase.from('activos').select('*').eq('ticker', 'BABA')
  if (!activos || activos.length === 0) {
    console.log("User does not have BABA in their DB.");
    return;
  }
  
  console.log("Activo BABA:", activos[0].id)
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 120) // look back 120 days to be sure

  const historicalDivs = await yahooFinance.historical('BABA', {
    period1: startDate,
    events: 'dividends'
  })
  
  console.log("Yahoo Finance Dividends (last 120 days):", historicalDivs)
  
  // Find transactions for BABA
  const { data: txs } = await supabase.from('transacciones').select('*').eq('activo_id', activos[0].id)
  console.log("Transactions for BABA:", txs?.length)
}
main();
