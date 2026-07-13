import { getMarketDateKey } from './market-performance'

export interface DailyPnlPoint {
  timestamp: string
  value: number
  totalInvested: number
  pnl: number
  totalPnl: number
  isFirstPoint: boolean
}

/**
 * Collapses intraday snapshots into one bar per US trading date. Incremental PnL
 * is summed, so PRE + REGULAR + POST remain one complete daily result.
 */
export function aggregateDailyPnl<T extends DailyPnlPoint>(points: T[]): DailyPnlPoint[] {
  const byMarketDate = new Map<string, DailyPnlPoint>()

  for (const point of points) {
    const marketDate = getMarketDateKey(point.timestamp)
    const existing = byMarketDate.get(marketDate)

    byMarketDate.set(marketDate, {
      ...point,
      // Noon UTC keeps yyyy-MM-dd stable when Recharts/date-fns formats it.
      timestamp: `${marketDate}T12:00:00.000Z`,
      pnl: (existing?.pnl ?? 0) + point.pnl,
      isFirstPoint: existing?.isFirstPoint ?? point.isFirstPoint,
    })
  }

  return Array.from(byMarketDate.values())
}
