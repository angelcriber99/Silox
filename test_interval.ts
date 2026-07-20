import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import YahooFinance from 'yahoo-finance2'

dotenv.config({ path: '.env.local' })

const yahoo = new YahooFinance()

async function testFetch() {
  try {
    const startFetchDate = new Date()
    startFetchDate.setFullYear(startFetchDate.getFullYear() - 2) // 2 years ago
    
    console.log("Fetching yahoo finance chart from", startFetchDate, "to now, interval 1m")
    const chartResponse = await yahoo.chart("AAPL", { period1: startFetchDate, interval: '1m' }).catch(e => { console.error("Yahoo error:", e.message); return null })
    
    console.log("Yahoo response length:", chartResponse?.quotes?.length)
  } catch(e) {
    console.error(e)
  }
}
testFetch()
