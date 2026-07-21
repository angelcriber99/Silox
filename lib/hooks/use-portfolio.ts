"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useEffect, useRef } from "react"
import type { EnrichedPosition, PortfolioTotals } from '@/lib/types'
import { fetchPosiciones, fetchPortfolioFunding, enrichPositions, computePortfolioTotals } from '@/lib/api/assets'
import { savePortfolioHistory } from '@/lib/api/assets'
import { usePrices } from "./use-prices"
import { fetchPendingTransactions } from '@/lib/api/transactions'
import { isInvestablePortfolioAsset } from '@/lib/domain/assets/normalization'

export function usePositions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["positions"],
    queryFn: fetchPosiciones,
    staleTime: 60_000, // 1 minute, but invalidated via websockets instantly
    enabled: options?.enabled ?? true,
  })
}

export function usePendingTransactions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["pending-transactions"],
    queryFn: fetchPendingTransactions,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  })
}

export function usePortfolioFunding(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["portfolio-funding"],
    queryFn: fetchPortfolioFunding,
    staleTime: 5 * 60_000,
    enabled: options?.enabled ?? true,
  })
}

export function usePortfolio(options?: { enabled?: boolean; persistHistory?: boolean }) {
  const enabled = options?.enabled ?? true
  const {
    data: positions,
    isLoading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = usePositions({ enabled })
  
  const {
    data: pendingTxs,
    refetch: refetchPending,
  } = usePendingTransactions({ enabled })

  const {
    data: funding,
    isLoading: contributionsLoading,
    error: contributionsError,
    refetch: refetchContributions,
  } = usePortfolioFunding({ enabled })

  // The posiciones view is the confirmed accounting source of truth. Pending
  // orders are fetched separately for projected balances and UI badges.
  const confirmedPositions = useMemo(() => {
    return (positions ?? []).filter(isInvestablePortfolioAsset)
  }, [positions])

  const tickers = useMemo(
    () => confirmedPositions
      .filter((p) => p.unidades > 0 || p.has_daily_activity)
      .map((p) => p.ticker),
    [confirmedPositions]
  )

  const {
    data: pricePayload,
    isLoading: pricesLoading,
    refetch: refetchPrices,
    dataUpdatedAt: pricesUpdatedAt,
  } = usePrices(tickers, { enabled })

  const enriched: EnrichedPosition[] = useMemo(() => {
    const enrichedList = enrichPositions(confirmedPositions, pricePayload ?? { prices: {} })
    return enrichedList
  }, [confirmedPositions, pricePayload])

  const totals: PortfolioTotals = useMemo(
    () => computePortfolioTotals(enriched, funding),
    [enriched, funding]
  )

  const latestSnapshot = useRef({ totalValue: totals.totalValue, totalCost: totals.totalCost })
  useEffect(() => {
    latestSnapshot.current = { totalValue: totals.totalValue, totalCost: totals.totalCost }
  }, [totals.totalValue, totals.totalCost])

  const historyReady = enabled && !positionsLoading && !pricesLoading && !contributionsLoading

  // Persist a real intraday point every 15 minutes while the dashboard is open.
  // The write function also enforces the same persistence window, so remounts do
  // not create duplicate points.
  useEffect(() => {
    if (!historyReady || !options?.persistHistory) return
    const persist = () => {
      const { totalValue, totalCost } = latestSnapshot.current
      if (totalValue > 0) savePortfolioHistory(totalValue, totalCost).catch(console.error)
    }
    persist()
    const timer = window.setInterval(persist, 15 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [historyReady, options?.persistHistory])

  const refetch = async () => {
    await Promise.all([
      refetchPositions(),
      refetchPending(),
      refetchContributions(),
      refetchPrices(),
    ])
  }

  return {
    positions: enriched,
    totals,
    isLoading: positionsLoading || contributionsLoading,
    pricesLoading,
    error: positionsError || contributionsError,
    refetch,
    refetchPrices,
    pricesUpdatedAt,
    marketState: pricePayload?.marketState ?? 'CLOSED',
    fxRates: pricePayload?.fxRates ?? { EUR: 1 },
    pendingTxs: pendingTxs ?? [],
  }
}

export function useHistory(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["portfolio-history"],
    queryFn: () => import('@/lib/api/assets').then(m => m.fetchHistory()),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    refetchInterval: options?.enabled === false ? false : 15 * 60 * 1000,
  })
}
