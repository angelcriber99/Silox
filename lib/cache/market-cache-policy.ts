export interface CacheablePriceEntry {
  price: number | null
}

export function hasUsableMarketPrice(entry: CacheablePriceEntry | undefined): boolean {
  return entry?.price != null && Number.isFinite(entry.price) && entry.price > 0
}

export function hasCompleteMarketPrices<T extends CacheablePriceEntry>(
  tickers: string[],
  prices: Record<string, T>,
): boolean {
  return tickers.every((ticker) => hasUsableMarketPrice(prices[ticker]))
}

export function firstUsableMarketPrice<T extends CacheablePriceEntry>(
  ...entries: Array<T | undefined>
): T | undefined {
  return entries.find((entry): entry is T => hasUsableMarketPrice(entry))
}
