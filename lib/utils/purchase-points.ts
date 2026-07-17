export interface PurchaseChartPoint {
  date: string
  price: number
}

export interface PurchasePoint {
  price: number
  confidence: number
  touches: number
  distancePercent: number
  rationale: string
}

const EPSILON = 0.00000001

function roundMarketPrice(value: number) {
  const decimals = value < 1 ? 4 : value < 10 ? 3 : 2
  return Number(value.toFixed(decimals))
}

/**
 * Detecta soportes repetidos y completa huecos con bandas de volatilidad.
 * El resultado es determinista y siempre se expresa en la misma divisa que
 * la serie de entrada (USD en la interfaz de puntos de compra).
 */
export function calculatePurchasePoints(
  chart: PurchaseChartPoint[],
  currentPrice: number,
  maxPoints = 3,
): PurchasePoint[] {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || maxPoints <= 0) return []

  const points = chart
    .filter((point) => Number.isFinite(point.price) && point.price > 0 && !Number.isNaN(new Date(point.date).getTime()))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
    .slice(-260)
  if (points.length < 8) return []

  const returns = points.slice(1).map((point, index) => Math.log(point.price / points[index].price))
  const recentReturns = returns.slice(-60)
  const mean = recentReturns.reduce((sum, value) => sum + value, 0) / Math.max(1, recentReturns.length)
  const variance = recentReturns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / Math.max(1, recentReturns.length - 1)
  const dailyVolatility = Math.max(0.005, Math.sqrt(variance))
  const clusterTolerance = Math.min(0.035, Math.max(0.0125, dailyVolatility * 0.65))

  const lows: Array<{ price: number; index: number }> = []
  for (let index = 3; index < points.length - 3; index += 1) {
    const price = points[index].price
    const neighbours = points.slice(index - 3, index + 4).filter((_, offset) => offset !== 3)
    if (neighbours.every((point) => price <= point.price) && price < currentPrice * 0.997 && price > currentPrice * 0.5) {
      lows.push({ price, index })
    }
  }

  const clusters: Array<{ prices: number[]; latestIndex: number }> = []
  for (const low of lows) {
    const cluster = clusters.find((candidate) => {
      const average = candidate.prices.reduce((sum, value) => sum + value, 0) / candidate.prices.length
      return Math.abs(low.price - average) / average <= clusterTolerance
    })
    if (cluster) {
      cluster.prices.push(low.price)
      cluster.latestIndex = Math.max(cluster.latestIndex, low.index)
    } else {
      clusters.push({ prices: [low.price], latestIndex: low.index })
    }
  }

  const candidates = clusters.map((cluster) => {
    const sorted = [...cluster.prices].sort((a, b) => a - b)
    const price = sorted[Math.floor(sorted.length / 2)]
    const distancePercent = ((price / currentPrice) - 1) * 100
    const recency = cluster.latestIndex / Math.max(1, points.length - 1)
    const proximity = Math.max(0, 1 - Math.abs(distancePercent) / 35)
    const confidence = Math.round(Math.min(95, 40 + cluster.prices.length * 12 + recency * 18 + proximity * 15))
    return {
      price: roundMarketPrice(price),
      confidence,
      touches: cluster.prices.length,
      distancePercent,
      rationale: `Soporte con ${cluster.prices.length} toque${cluster.prices.length === 1 ? "" : "s"}; volatilidad diaria ${(dailyVolatility * 100).toFixed(1)}%.`,
    }
  }).sort((left, right) => right.confidence - left.confidence || right.price - left.price)

  const horizons = [5, 15, 30, 50]
  for (const days of horizons) {
    if (candidates.length >= maxPoints * 2) break
    const price = currentPrice * Math.exp(-dailyVolatility * Math.sqrt(days))
    if (price >= currentPrice || price <= currentPrice * 0.5) continue
    const isDuplicate = candidates.some((candidate) => Math.abs(candidate.price - price) / price < clusterTolerance)
    if (!isDuplicate) {
      candidates.push({
        price: roundMarketPrice(price),
        confidence: Math.max(35, 62 - days),
        touches: 0,
        distancePercent: ((price / currentPrice) - 1) * 100,
        rationale: `Banda estadística de ${days} sesiones con volatilidad diaria ${(dailyVolatility * 100).toFixed(1)}%.`,
      })
    }
  }

  return candidates
    .filter((candidate) => candidate.price > EPSILON && candidate.price < currentPrice)
    .sort((left, right) => right.price - left.price)
    .slice(0, maxPoints)
}
