import { getMarketDateKey } from './market-performance'

export type PerformanceRange = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL'

export interface PortfolioSnapshot {
  timestamp: string
  total_value: number
  total_invested: number
}

export interface PerformancePoint {
  timestamp: string
  value: number
  totalInvested: number
  /** Profit generated since the preceding real snapshot, adjusted for net flows. */
  pnl: number
  /** Cumulative profit: portfolio value minus net capital contributed. */
  totalPnl: number
  /** Net capital added or removed since the preceding real snapshot. */
  netFlow: number
  /** Real portfolio value immediately before this interval. */
  previousValue: number
  pnlPercent: number
  isFirstPoint: boolean
  isBoundary?: boolean
}

export interface PerformanceSummary {
  startValue: number
  endValue: number
  netFlow: number
  profit: number
  profitPercent: number
  totalProfit: number
  totalProfitPercent: number
}

function isValidSnapshot(snapshot: PortfolioSnapshot): boolean {
  return Boolean(snapshot.timestamp)
    && Number.isFinite(new Date(snapshot.timestamp).getTime())
    && Number.isFinite(snapshot.total_value)
    && Number.isFinite(snapshot.total_invested)
    && snapshot.total_value >= 0
}

/**
 * Builds a single accounting series from persisted snapshots. Every interval
 * uses: market profit = change in value - net external flow. This prevents a
 * deposit, withdrawal, buy or sale from appearing as investment performance.
 */
export function buildPerformanceSeries(
  snapshots: PortfolioSnapshot[],
  current?: PortfolioSnapshot,
): PerformancePoint[] {
  const normalized = snapshots
    .filter(isValidSnapshot)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())

  if (current && isValidSnapshot(current)) {
    const latest = normalized.at(-1)
    const isSameAsLatest = latest
      && Math.abs(latest.total_value - current.total_value) < 0.005
      && Math.abs(latest.total_invested - current.total_invested) < 0.005
      && Math.abs(new Date(latest.timestamp).getTime() - new Date(current.timestamp).getTime()) < 60_000
    if (!isSameAsLatest) normalized.push(current)
  }

  const byTimestamp = new Map<string, PortfolioSnapshot>()
  for (const snapshot of normalized) byTimestamp.set(snapshot.timestamp, snapshot)
  const sorted = Array.from(byTimestamp.values())
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())

  return sorted.map((snapshot, index) => {
    const previous = sorted[index - 1]
    const totalPnl = snapshot.total_value - snapshot.total_invested
    const netFlow = previous ? snapshot.total_invested - previous.total_invested : 0
    const pnl = previous ? snapshot.total_value - previous.total_value - netFlow : 0
    const previousValue = previous?.total_value ?? snapshot.total_value
    const capitalBase = Math.max(0, previousValue + Math.max(0, netFlow))

    return {
      timestamp: snapshot.timestamp,
      value: snapshot.total_value,
      totalInvested: snapshot.total_invested,
      pnl,
      totalPnl,
      netFlow,
      previousValue,
      pnlPercent: capitalBase > 0 ? (pnl / capitalBase) * 100 : 0,
      isFirstPoint: index === 0,
    }
  })
}

export function filterPerformanceSeries(
  points: PerformancePoint[],
  range: PerformanceRange,
  timeOffset = 0,
  baseNow = new Date(),
): PerformancePoint[] {
  if (range === 'ALL') return points

  const now = new Date(baseNow)
  if (timeOffset !== 0) {
    if (range === '1D') now.setDate(now.getDate() + timeOffset)
    else if (range === '1W') now.setDate(now.getDate() + timeOffset * 7)
    else if (range === '1M') now.setMonth(now.getMonth() + timeOffset)
    else if (range === '1Y') now.setFullYear(now.getFullYear() + timeOffset)
  }
  const end = now.getTime()
  if (range === '1D') {
    const marketDate = getMarketDateKey(now)
    const todayPoints = points.filter((point) => getMarketDateKey(point.timestamp) === marketDate)
    
    const previousPoints = points.filter((point) => 
      getMarketDateKey(point.timestamp) !== marketDate && 
      new Date(point.timestamp).getTime() < now.getTime()
    )
    const lastPreviousPoint = previousPoints.at(-1)

    if (lastPreviousPoint) {
      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)
      
      // Only add the baseline if it's strictly before the first real point of today
      // to avoid overlapping timestamps
      const firstTodayTime = todayPoints.length > 0 ? new Date(todayPoints[0].timestamp).getTime() : Infinity
      if (startOfDay.getTime() < firstTodayTime) {
        const baselinePoint = {
          ...lastPreviousPoint,
          timestamp: startOfDay.toISOString(),
          pnl: 0,
          pnlPercent: 0,
          netFlow: 0,
          previousValue: lastPreviousPoint.value,
          isFirstPoint: true,
          isBoundary: true,
        }
        return [baselinePoint, ...todayPoints].filter(p => new Date(p.timestamp).getTime() <= end)
      }
    }
    return todayPoints.filter(p => new Date(p.timestamp).getTime() <= end)
  }

  let start: number
  if (range === 'YTD') {
    start = new Date(now.getFullYear(), 0, 1).getTime()
  } else {
    const startObj = new Date(now)
    if (range === '1W') startObj.setDate(startObj.getDate() - 7)
    else if (range === '1M') startObj.setMonth(startObj.getMonth() - 1)
    else if (range === '1Y') startObj.setFullYear(startObj.getFullYear() - 1)
    start = startObj.getTime()
  }
  const inRange = points.filter((point) => {
    const t = new Date(point.timestamp).getTime()
    return t >= start && t <= end
  })
  if (inRange.length === 0) return []

  const previous = points
    .filter((point) => new Date(point.timestamp).getTime() < start)
    .at(-1)
  if (!previous) return inRange

  return [{
    ...previous,
    timestamp: new Date(start).toISOString(),
    pnl: 0,
    pnlPercent: 0,
    netFlow: 0,
    previousValue: previous.value,
    isFirstPoint: true,
    isBoundary: true,
  }, ...inRange]
}

/** Modified Dietz denominator gives a flow-adjusted period return. */
export function summarizePerformance(points: PerformancePoint[], range: PerformanceRange): PerformanceSummary {
  if (points.length === 0) {
    return { startValue: 0, endValue: 0, netFlow: 0, profit: 0, profitPercent: 0, totalProfit: 0, totalProfitPercent: 0 }
  }

  const target = points.at(-1)!
  const totalProfit = target.totalPnl
  const totalProfitPercent = target.totalInvested > 0 ? (totalProfit / target.totalInvested) * 100 : 0
  const startValue = points[0].previousValue
  const netFlow = points.reduce((sum, point) => sum + point.netFlow, 0)
  if (range === 'ALL') {
    return {
      startValue,
      endValue: target.value,
      netFlow,
      profit: totalProfit,
      profitPercent: totalProfitPercent,
      totalProfit,
      totalProfitPercent,
    }
  }

  const profit = points.reduce((sum, point) => sum + point.pnl, 0)
  const startTime = new Date(points[0].timestamp).getTime()
  const endTime = new Date(target.timestamp).getTime()
  const duration = Math.max(1, endTime - startTime)
  const weightedFlows = points.reduce((sum, point) => {
    const remainingWeight = Math.max(0, endTime - new Date(point.timestamp).getTime()) / duration
    return sum + point.netFlow * remainingWeight
  }, 0)
  const denominator = startValue + weightedFlows

  return {
    startValue,
    endValue: target.value,
    netFlow,
    profit,
    profitPercent: denominator > 0 ? (profit / denominator) * 100 : 0,
    totalProfit,
    totalProfitPercent,
  }
}

/** Collapses PRE + REGULAR + POST into one complete US trading-day bar. */
export function aggregateDailyPnl(points: PerformancePoint[]): PerformancePoint[] {
  const groups = new Map<string, PerformancePoint[]>()
  for (const point of points) {
    const key = getMarketDateKey(point.timestamp)
    groups.set(key, [...(groups.get(key) ?? []), point])
  }

  return Array.from(groups.entries()).map(([marketDate, dayPoints]) => {
    const sorted = dayPoints.sort(
      (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    )
    const first = sorted[0]
    const latest = sorted.at(-1)!
    const pnl = sorted.reduce((sum, point) => sum + point.pnl, 0)
    const dailySummary = summarizePerformance(sorted, '1D')

    return {
      ...latest,
      timestamp: `${marketDate}T12:00:00.000Z`,
      pnl,
      pnlPercent: dailySummary.profitPercent,
      previousValue: first.previousValue,
      netFlow: sorted.reduce((sum, point) => sum + point.netFlow, 0),
      isFirstPoint: first.isFirstPoint,
    }
  })
}

export function aggregateMonthlyPnl(points: PerformancePoint[]): PerformancePoint[] {
  const groups = new Map<string, PerformancePoint[]>()
  for (const point of points) {
    const d = new Date(point.timestamp)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    groups.set(key, [...(groups.get(key) ?? []), point])
  }

  return Array.from(groups.entries()).map(([monthKey, monthPoints]) => {
    const sorted = monthPoints.sort(
      (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    )
    const first = sorted[0]
    const latest = sorted.at(-1)!
    const pnl = sorted.reduce((sum, point) => sum + point.pnl, 0)
    // Create a pseudo-range covering this month for summarizePerformance
    const monthlySummary = summarizePerformance(sorted, '1M')

    return {
      ...latest,
      timestamp: `${monthKey}-15T12:00:00.000Z`, // Middle of the month for plotting
      pnl,
      pnlPercent: monthlySummary.profitPercent,
      previousValue: first.previousValue,
      netFlow: sorted.reduce((sum, point) => sum + point.netFlow, 0),
      isFirstPoint: first.isFirstPoint,
    }
  })
}
