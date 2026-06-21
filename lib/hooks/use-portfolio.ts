"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { EnrichedPosition, PortfolioTotals } from '@/lib/types'
import { fetchPosiciones, enrichPositions, computePortfolioTotals } from '@/lib/api/assets'
import { usePrices } from "./use-prices"

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: fetchPosiciones,
    staleTime: 30_000,
  })
}

export function usePortfolio() {
  const {
    data: positions,
    isLoading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = usePositions()

  const tickers = useMemo(
    () => (positions ?? []).filter((p) => p.unidades > 0).map((p) => p.ticker),
    [positions]
  )

  const {
    data: pricePayload,
    isLoading: pricesLoading,
    refetch: refetchPrices,
  } = usePrices(tickers)

  const enriched: EnrichedPosition[] = useMemo(() => {
    if (!positions) return []
    return enrichPositions(positions, pricePayload ?? { prices: {} })
  }, [positions, pricePayload])

  const totals: PortfolioTotals = useMemo(
    () => computePortfolioTotals(enriched),
    [enriched]
  )

  const refetch = async () => {
    await refetchPositions()
    await refetchPrices()
  }

  return {
    positions: enriched,
    totals,
    isLoading: positionsLoading,
    pricesLoading,
    error: positionsError,
    refetch,
    refetchPrices,
  }
}
