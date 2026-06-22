"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchPrices } from '@/lib/api/market'

export function usePrices(tickers: string[]) {
  return useQuery({
    queryKey: ["prices", tickers.slice().sort().join(",")],
    queryFn: () => fetchPrices(tickers),
    enabled: tickers.length > 0,
    staleTime: 15_000,
    refetchInterval: 15_000, // Auto-refresh every 15 seconds
  })
}
