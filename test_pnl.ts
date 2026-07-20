import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import YahooFinance from 'yahoo-finance2'
import { buildAssetHistory, AssetHistoryPoint } from './lib/utils/asset-performance'

dotenv.config({ path: '.env.local' })

const yahoo = new YahooFinance()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getPeriod(range: string): Date {
  const d = new Date()
  switch (range) {
    case "1D": d.setDate(d.getDate() - 1); break
    case "1W": d.setDate(d.getDate() - 7); break
    case "1M": d.setMonth(d.getMonth() - 1); break
    case "1Y": d.setFullYear(d.getFullYear() - 1); break
    case "YTD": d.setMonth(0, 1); break
    case "ALL": d.setFullYear(2000); break
  }
  return d
}

async function fetchAssetHistoricalPerformance(assetId: string, range: string): Promise<AssetHistoryPoint[]> {
  const { data: asset } = await supabase.from("activos").select("ticker, moneda").eq("id", assetId).single()
  if (!asset) throw new Error("Asset not found")

  const { data: transactions } = await supabase.from('transacciones').select('*').eq('activo_id', assetId).order('fecha', {ascending:true})
  if (!transactions || transactions.length === 0) return []

  const firstTxDate = new Date(transactions[0].fecha)
  const period1 = getPeriod(range)
  
  const startFetchDate = firstTxDate < period1 ? firstTxDate : period1
  const interval = "1d" // Hardcoded for "1M" range

  const chartResponse = await yahoo.chart(asset.ticker, { period1: startFetchDate, interval }).catch(e => { console.error("Yahoo Chart error:", e.message); return null })
  if (!chartResponse || !chartResponse.quotes || chartResponse.quotes.length === 0) {
    console.log("Empty chart response")
    return []
  }

  const priceChart = chartResponse.quotes
    .filter((q) => q.date && q.close != null)
    .map((q) => ({
      date: q.date.toISOString().split("T")[0],
      price: q.close!,
    }))

  let fxChart: { date: string; rate: number }[] | null = null
  if (asset.moneda && asset.moneda !== "EUR") {
    const fxTicker = `EUR${asset.moneda}=X`
    const fxResponse = await yahoo.chart(fxTicker, { period1: startFetchDate, interval }).catch(e => { console.error("FX Yahoo error:", e.message); return null })
    if (fxResponse && fxResponse.quotes) {
      fxChart = fxResponse.quotes
        .filter((q) => q.date && q.close != null)
        .map((q) => ({
          date: q.date.toISOString().split("T")[0],
          rate: q.close!,
        }))
    }
  }

  const fullHistory = buildAssetHistory(transactions as any, priceChart, fxChart, asset.moneda)
  const targetStartDateStr = period1.toISOString().split("T")[0]
  
  console.log("Full history size:", fullHistory.length)
  return fullHistory.filter((p) => p.date >= targetStartDateStr)
}

async function run() {
  const { data: asset } = await supabase.from('activos').select('id, ticker').eq('ticker', 'AAPL').limit(1).single()
  if (!asset) return
  
  const result = await fetchAssetHistoricalPerformance(asset.id, "1M")
  console.log("Filtered Result Size:", result.length)
  if (result.length > 0) {
    console.log("First Point:", result[0])
    console.log("Last Point:", result[result.length - 1])
  }
}
run()
