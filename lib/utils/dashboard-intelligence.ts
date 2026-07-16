import type { EnrichedPosition } from "@/lib/types"

export const DASHBOARD_COLORS: Record<string, string> = {
  "Acción": "#38bdf8",
  ETF: "#2dd4bf",
  "Fondo Indexado": "#a78bfa",
  "Fondo Monetario": "#fbbf24",
  Crypto: "#fb923c",
  Liquidez: "#94a3b8",
}

export interface AllocationSlice {
  name: string
  value: number
  percent: number
  color: string
}

export interface SessionSlice {
  state: string
  count: number
}

export interface DashboardIntelligence {
  active: EnrichedPosition[]
  invested: EnrichedPosition[]
  allocation: AllocationSlice[]
  sessions: SessionSlice[]
  best?: EnrichedPosition
  worst?: EnrichedPosition
  largest?: EnrichedPosition
  concentration: number
  cash: number
  cashPercent: number
  freshPrices: number
  winners: number
  losers: number
  flat: number
  foreignCurrencyExposure: number
}

export function buildDashboardIntelligence(
  positions: EnrichedPosition[],
  totalValue: number,
): DashboardIntelligence {
  const active = positions.filter((position) => position.unidades > 0)
  const invested = active.filter(
    (position) => position.tipo !== "Liquidez" && !position.ticker.startsWith("CASH"),
  )
  const allocationMap = new Map<string, number>()
  const sessionMap = new Map<string, number>()
  let cash = 0
  let freshPrices = 0
  let winners = 0
  let losers = 0
  let flat = 0
  let foreignValue = 0

  for (const position of active) {
    const value = position.valor_actual ?? 0
    const isCash = position.tipo === "Liquidez" || position.ticker.startsWith("CASH")
    const allocationName = isCash ? "Liquidez" : position.tipo
    allocationMap.set(allocationName, (allocationMap.get(allocationName) ?? 0) + value)

    if (isCash) {
      cash += value
      continue
    }

    const state = position.market_state ?? "CLOSED"
    sessionMap.set(state, (sessionMap.get(state) ?? 0) + 1)
    if (!position.price_is_stale && position.precio_actual !== null) freshPrices += 1
    if ((position.daily_change_percent_24h ?? 0) > 0) winners += 1
    else if ((position.daily_change_percent_24h ?? 0) < 0) losers += 1
    else flat += 1

    const nativeCurrency = position.original_currency ?? position.moneda
    if (nativeCurrency && nativeCurrency !== "EUR") foreignValue += value
  }

  const allocation = [...allocationMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name, value]) => ({
      name,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      color: DASHBOARD_COLORS[name] ?? "#64748b",
    }))

  const movers = invested
    .filter((position) => position.daily_change_percent_24h !== null)
    .sort(
      (left, right) =>
        (right.daily_change_percent_24h ?? 0) - (left.daily_change_percent_24h ?? 0),
    )
  const largest = [...invested].sort(
    (left, right) => (right.valor_actual ?? 0) - (left.valor_actual ?? 0),
  )[0]

  return {
    active,
    invested,
    allocation,
    sessions: [...sessionMap.entries()]
      .map(([state, count]) => ({ state, count }))
      .sort((left, right) => right.count - left.count),
    best: movers[0],
    worst: movers.at(-1),
    largest,
    concentration:
      largest && totalValue > 0 ? ((largest.valor_actual ?? 0) / totalValue) * 100 : 0,
    cash,
    cashPercent: totalValue > 0 ? (cash / totalValue) * 100 : 0,
    freshPrices,
    winners,
    losers,
    flat,
    foreignCurrencyExposure: totalValue > 0 ? (foreignValue / totalValue) * 100 : 0,
  }
}
