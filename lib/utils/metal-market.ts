export type MetalRateCode = 'xag' | 'xau' | 'xpd' | 'xpt'

export interface MetalRateSnapshot {
  date: string
  rates: Partial<Record<MetalRateCode, number>>
}

export interface MetalPriceMetrics {
  price: number
  sparkline: number[]
  changePercent: number | null
}

export type MetalChartRange = '1d' | '5d' | '1mo' | '6mo' | 'ytd' | '1y' | '5y' | 'max'

export interface MetalChartPoint {
  date: string
  price: number
}

function priceFromRate(rate: number | undefined): number | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null
  return 1 / rate
}

export function buildMetalPriceMetrics(
  metalCode: MetalRateCode,
  latest: MetalRateSnapshot,
  history: MetalRateSnapshot[],
): MetalPriceMetrics | null {
  const price = priceFromRate(latest.rates[metalCode])
  if (price == null) return null

  const historicalPrices = history
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((snapshot) => priceFromRate(snapshot.rates[metalCode]))
    .filter((value): value is number => value != null)

  const previousPrice = historicalPrices.at(-1) ?? null
  const changePercent = previousPrice == null
    ? null
    : ((price - previousPrice) / previousPrice) * 100

  return {
    price,
    sparkline: [...historicalPrices, price],
    changePercent,
  }
}

export function buildMetalChartPoints(
  metalCode: MetalRateCode,
  snapshots: MetalRateSnapshot[],
): MetalChartPoint[] {
  return snapshots
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((snapshot) => {
      const price = priceFromRate(snapshot.rates[metalCode])
      return price == null
        ? []
        : [{ date: `${snapshot.date}T00:00:00.000Z`, price }]
    })
}

export function getMetalChartDateKeys(
  latestDate: string,
  range: MetalChartRange,
): string[] {
  const end = new Date(`${latestDate}T00:00:00Z`)
  if (Number.isNaN(end.getTime())) return []

  const start = new Date(end)
  switch (range) {
    case '1d': start.setUTCDate(start.getUTCDate() - 1); break
    case '5d': start.setUTCDate(start.getUTCDate() - 5); break
    case '1mo': start.setUTCMonth(start.getUTCMonth() - 1); break
    case '6mo': start.setUTCMonth(start.getUTCMonth() - 6); break
    case 'ytd': start.setUTCMonth(0, 1); break
    case '1y': start.setUTCFullYear(start.getUTCFullYear() - 1); break
    case '5y': start.setUTCFullYear(start.getUTCFullYear() - 5); break
    case 'max': start.setUTCFullYear(start.getUTCFullYear() - 10); break
  }

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  const stepDays = range === '1d' || range === '5d' || range === '1mo'
    ? 1
    : Math.max(1, Math.ceil(totalDays / 30))

  const dates: string[] = []
  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + stepDays)) {
    dates.push(cursor.toISOString().slice(0, 10))
  }

  if (dates.at(-1) !== latestDate) dates.push(latestDate)
  return dates
}
