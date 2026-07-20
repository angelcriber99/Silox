import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import YahooFinance from 'yahoo-finance2'

dotenv.config({ path: '.env.local' })

const yahoo = new YahooFinance()

async function testFetch() {
  const ticker = '0P0001CJGV.F'
  try {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    const [chart1m, chart1d] = await Promise.all([
      yahoo.chart(ticker, { interval: '1m', period1: new Date(Date.now() - 24 * 60 * 60 * 1000), includePrePost: true }).catch(e => null),
      yahoo.chart(ticker, { interval: '1d', period1: d }).catch(e => null)
    ])
    
    console.log("meta regularMarketPrice:", chart1m?.meta?.regularMarketPrice)
    console.log("chart1d quotes length:", chart1d?.quotes?.length)
    if (chart1d?.quotes?.length) {
      console.log("Last 2 1d quotes:", chart1d.quotes.slice(-2).map(q => ({ date: q.date, close: q.close })))
    }
  } catch(e) {
    console.error(e)
  }
}
testFetch()
