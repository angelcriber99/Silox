"use server"

import { fetchAssetTransactions } from "@/lib/api/transactions"
import { getYahooFinance } from "@/lib/server/yahoo-finance"
import { buildAssetHistory, AssetHistoryPoint } from "@/lib/utils/asset-performance"
import { createClient } from "@/lib/supabase/server"
import { PerformanceRange } from "@/lib/utils/performance-history"

function getInterval(range: PerformanceRange): "1d" | "1m" | "1wk" | "1mo" {
  switch (range) {
    case "1D":
      return "1m"
    case "1W":
    case "1M":
      return "1d"
    case "1Y":
    case "YTD":
      return "1wk"
    case "ALL":
      return "1mo"
  }
}

function getPeriod(range: PerformanceRange): Date {
  const d = new Date()
  switch (range) {
    case "1D":
      d.setDate(d.getDate() - 1)
      break
    case "1W":
      d.setDate(d.getDate() - 7)
      break
    case "1M":
      d.setMonth(d.getMonth() - 1)
      break
    case "1Y":
      d.setFullYear(d.getFullYear() - 1)
      break
    case "YTD":
      d.setMonth(0, 1) // Jan 1st of current year
      break
    case "ALL":
      d.setFullYear(2000) // Fetch all
      break
  }
  return d
}

export async function fetchAssetHistoricalPerformance(
  assetId: string,
  range: PerformanceRange
): Promise<AssetHistoryPoint[]> {
  try {
    // 1. Fetch asset metadata and transactions
    const supabase = await createClient()
    const { data: asset, error: assetError } = await supabase
      .from("activos")
      .select("ticker, moneda")
      .eq("id", assetId)
      .single()

    if (assetError || !asset) throw new Error("Asset not found")

    const transactions = await fetchAssetTransactions(assetId)
    if (!transactions || transactions.length === 0) return []

    // 2. Determine timeframe
    const firstTxDate = new Date(transactions[0].fecha)
    const period1 = getPeriod(range)
    
    // We need data starting from either the selected range OR the first transaction, whichever is older, 
    // so we can properly reconstruct the cost basis before slicing it for the frontend.
    // Actually, Yahoo chart needs to be from period1. If period1 is older than firstTxDate, we use firstTxDate.
    // If firstTxDate is older than period1, we STILL need Yahoo prices from firstTxDate to correctly map!
    // So we always fetch from firstTxDate or period1 (whichever is earlier).
    const startFetchDate = firstTxDate < period1 ? firstTxDate : period1

    const interval = getInterval(range)

    // 3. Fetch Asset Chart
    const chartResponse = await getYahooFinance()
      .chart(asset.ticker, { period1: startFetchDate, interval })
      .catch(() => null)

    if (!chartResponse || !chartResponse.quotes || chartResponse.quotes.length === 0) {
      return []
    }

    const priceChart = chartResponse.quotes
      .filter((q) => q.date && q.close != null)
      .map((q) => ({
        date: q.date.toISOString().split("T")[0],
        price: q.close!,
      }))

    // 4. Fetch FX Chart if needed
    let fxChart: { date: string; rate: number }[] | null = null
    if (asset.moneda && asset.moneda !== "EUR") {
      const fxTicker = `${asset.moneda}EUR=X`
      const fxResponse = await getYahooFinance()
        .chart(fxTicker, { period1: startFetchDate, interval })
        .catch(() => null)

      if (fxResponse && fxResponse.quotes) {
        fxChart = fxResponse.quotes
          .filter((q) => q.date && q.close != null)
          .map((q) => ({
            date: q.date.toISOString().split("T")[0],
            rate: q.close!, // This means 1 USD = rate EUR. Wait. 
            // In Yahoo, USDEUR=X is how many EUR per 1 USD (e.g. 0.92). 
            // EURUSD=X is how many USD per 1 EUR (e.g. 1.08).
            // Usually, we use EURUSD=X and rate = 1.08. 
            // The existing backend uses EURUSD=X. Let's stick to EURUSD=X.
          }))
      }
    }

    // Since our existing backend FX_PAIRS uses "EURUSD=X" where rate = 1.08,
    // let's fetch "EURUSD=X" instead of "USDEUR=X" to keep math consistent with asset-performance.ts (price / rate)
    if (asset.moneda && asset.moneda !== "EUR") {
      const fxTicker = `EUR${asset.moneda}=X` // e.g. EURUSD=X
      const fxResponse = await getYahooFinance()
        .chart(fxTicker, { period1: startFetchDate, interval })
        .catch(() => null)

      if (fxResponse && fxResponse.quotes) {
        fxChart = fxResponse.quotes
          .filter((q) => q.date && q.close != null)
          .map((q) => ({
            date: q.date.toISOString().split("T")[0],
            rate: q.close!,
          }))
      }
    }

    // 5. Build full history
    const fullHistory = buildAssetHistory(transactions, priceChart, fxChart, asset.moneda)

    // 6. Filter down to the requested range for the UI
    const targetStartDateStr = period1.toISOString().split("T")[0]
    return fullHistory.filter((p) => p.date >= targetStartDateStr)
  } catch (error) {
    console.error("Error fetching asset historical performance:", error)
    return []
  }
}
