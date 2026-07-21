import { getSupabaseAdmin } from '../lib/supabase/admin'
import { getYahooFinance } from '../lib/server/yahoo-finance'

async function main() {
  const yahooFinance = getYahooFinance()
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 150)

  const historicalDivs = await yahooFinance.historical('BABA', {
    period1: startDate,
    events: 'dividends'
  })
  
  console.log("Yahoo Finance Dividends for BABA:", historicalDivs)
}
main();
