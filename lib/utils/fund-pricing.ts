import { getMarketDateKey } from './market-performance'

const DEFAULT_FUND_TIME_ZONE = 'Europe/Berlin'
const MAX_EXPECTED_NAV_BUSINESS_DAY_AGE = 2

function businessDaysBetween(fromDate: string, toDate: string): number {
  const cursor = new Date(`${fromDate}T12:00:00Z`)
  const end = new Date(`${toDate}T12:00:00Z`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor >= end) return 0

  let count = 0
  cursor.setUTCDate(cursor.getUTCDate() + 1)
  while (cursor <= end) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) count += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

interface FundPricingInput {
  currentPrice?: number | null
  previousClose?: number | null
  asOf?: string | Date | number
  exchangeTimezone?: string
  now?: Date
}

export interface FundPricingResult {
  currentPrice: number | null
  dailyChangePercent: number
  asOf?: Date
  effectiveDate?: string
  isStale: boolean
}

/**
 * Funds publish a NAV, not an intraday quote. Keep the latest valid NAV even
 * when it belongs to a prior business day, while reporting today's movement as
 * zero until a NAV whose effective date is today is published.
 */
export function deriveFundPricing({
  currentPrice,
  previousClose,
  asOf,
  exchangeTimezone = DEFAULT_FUND_TIME_ZONE,
  now = new Date(),
}: FundPricingInput): FundPricingResult {
  const price = currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0
    ? currentPrice
    : null
  const parsedAsOf = asOf == null ? undefined : new Date(asOf)
  const validAsOf = parsedAsOf && !Number.isNaN(parsedAsOf.getTime()) ? parsedAsOf : undefined
  const today = getMarketDateKey(now, exchangeTimezone)
  const effectiveDate = validAsOf ? getMarketDateKey(validAsOf, exchangeTimezone) : undefined
  const isPublishedToday = effectiveDate === today
  const change = isPublishedToday && price != null && previousClose != null && previousClose > 0
    ? ((price / previousClose) - 1) * 100
    : 0
  const businessDayAge = effectiveDate ? businessDaysBetween(effectiveDate, today) : Number.POSITIVE_INFINITY

  return {
    currentPrice: price,
    dailyChangePercent: change,
    asOf: validAsOf,
    effectiveDate,
    isStale: businessDayAge > MAX_EXPECTED_NAV_BUSINESS_DAY_AGE,
  }
}
