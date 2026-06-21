"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchPrices } from '@/lib/api/market'

export function usePrices(tickers: string[]) {
  return useQuery({
    queryKey: ["prices", tickers.slice().sort().join(",")],
    queryFn: () => fetchPrices(tickers),
    enabled: tickers.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000, // Auto-refresh every 60 seconds
  })
}
