"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useEffect, useRef } from "react"
import type { EnrichedPosition, PortfolioTotals } from '@/lib/types'
import { fetchPosiciones, enrichPositions, computePortfolioTotals, saveDailySnapshot } from '@/lib/api/assets'
import { usePrices } from "./use-prices"
import { createClient } from '@/lib/supabase/client'

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: fetchPosiciones,
    staleTime: 60_000, // 1 minute, but invalidated via websockets instantly
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
    dataUpdatedAt: pricesUpdatedAt,
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

  // Supabase Realtime: Súper Tiempo Real
  useEffect(() => {
    const supabase = createClient()
    const channelName = `portfolio-realtime-${Math.random()}`
    
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posiciones' }, () => {
        refetchPositions()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transacciones' }, () => {
        refetchPositions()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetchPositions])

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
    pricesUpdatedAt,
  }
}

export function useSnapshots() {
  return useQuery({
    queryKey: ["portfolio-snapshots"],
    queryFn: () => import('@/lib/api/assets').then(m => m.fetchSnapshots()),
    staleTime: 5 * 60 * 1000,
  })
}
