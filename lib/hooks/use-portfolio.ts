"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { EnrichedPosition, PortfolioTotals } from '@/lib/types'
import { useEffect, useRef } from "react"
import { fetchPosiciones, enrichPositions, computePortfolioTotals, saveDailySnapshot } from '@/lib/api/assets'
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

  const snapshotSaved = useRef(false)

  // Save daily snapshot automatically
  useEffect(() => {
    if (!positionsLoading && !pricesLoading && totals.totalValue > 0 && !snapshotSaved.current) {
      snapshotSaved.current = true
      saveDailySnapshot(totals.totalValue, totals.totalCost).catch(console.error)
    }
  }, [totals.totalValue, totals.totalCost, positionsLoading, pricesLoading])

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

export function useSnapshots() {
  return useQuery({
    queryKey: ["portfolio-snapshots"],
    queryFn: () => import('@/lib/api/assets').then(m => m.fetchSnapshots()),
    staleTime: 5 * 60 * 1000,
  })
}
