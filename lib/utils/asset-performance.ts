import { Transaccion } from "@/lib/types"

export interface AssetHistoryPoint {
  date: string
  value: number
  cost: number
  pnl: number
  units: number
}

export function buildAssetHistory(
  transactions: Transaccion[],
  priceChart: { date: string; price: number }[],
  fxChart: { date: string; rate: number }[] | null,
  assetCurrency: string
): AssetHistoryPoint[] {
  // 1. Build a timeline of units and cost basis
  const timeline = new Map<string, { units: number; cost: number }>()
  
  // Sort transactions by date ascending
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  
  let currentUnits = 0
  let currentCost = 0

  // Calculate cumulative position per transaction day
  for (const tx of sortedTxs) {
    if (tx.estado === "Pendiente") continue

    const dateKey = tx.fecha.split("T")[0]
    
    // Exchange rate handling
    const fxRate = tx.tipo_cambio_eur ?? 1
    const costInEur = (tx.cantidad * tx.precio_unitario) / fxRate

    if (tx.tipo_operacion === "Compra") {
      currentUnits += tx.cantidad
      currentCost += costInEur
    } else if (tx.tipo_operacion === "Venta") {
      // Calculate proportional cost reduction
      if (currentUnits > 0) {
        const avgCost = currentCost / currentUnits
        currentCost -= avgCost * tx.cantidad
      }
      currentUnits -= tx.cantidad
      if (currentUnits < 0) currentUnits = 0
    }

    timeline.set(dateKey, { units: currentUnits, cost: currentCost })
  }

  // Flatten timeline to daily values (fill gaps)
  let lastKnown = { units: 0, cost: 0 }
  
  // Create a sorted list of all dates we care about (from first tx to today)
  const firstTxDate = sortedTxs.length > 0 ? sortedTxs[0].fecha.split("T")[0] : null
  if (!firstTxDate) return []

  // Create a map for FX rates
  const fxMap = new Map<string, number>()
  if (fxChart) {
    for (const point of fxChart) {
      fxMap.set(point.date, point.rate)
    }
  }

  // 2. Map market prices to the timeline
  const result: AssetHistoryPoint[] = []
  let lastFxRate = 1

  for (const point of priceChart) {
    const day = point.date
    
    // If the market price is before our first transaction, skip
    if (day < firstTxDate) continue

    // Update last known position if there was a transaction this day
    if (timeline.has(day)) {
      lastKnown = timeline.get(day)!
    }
    
    // Get FX Rate
    if (fxChart) {
      if (fxMap.has(day)) lastFxRate = fxMap.get(day)!
    } else {
      lastFxRate = 1 // Already in EUR or assumed 1:1
    }

    const priceInEur = assetCurrency === "EUR" ? point.price : point.price / lastFxRate
    const value = lastKnown.units * priceInEur
    const cost = lastKnown.cost
    const pnl = value - cost

    result.push({
      date: day,
      value,
      cost,
      pnl,
      units: lastKnown.units,
    })
  }

  return result
}
