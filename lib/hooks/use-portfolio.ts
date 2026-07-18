"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useEffect, useRef, useState } from "react"
import type { EnrichedPosition, PortfolioTotals } from '@/lib/types'
import { fetchPosiciones, fetchPortfolioFunding, enrichPositions, computePortfolioTotals } from '@/lib/api/assets'
import { savePortfolioHistory } from '@/lib/api/assets'
import { usePrices } from "./use-prices"
import { createClient } from '@/lib/supabase/client'
import { fetchPendingTransactions } from '@/lib/api/transactions'
import { isInvestablePortfolioAsset } from '@/lib/domain/assets/normalization'
import { convertNetInvestmentToEur } from '@/lib/domain/portfolio/contributions'

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
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  })
}

export function usePortfolio(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
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
      .filter((p) => p.unidades > 0)
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

  const netContributions = useMemo(
    () => convertNetInvestmentToEur(funding, pricePayload?.fxRates),
    [funding, pricePayload?.fxRates]
  )

  const totals: PortfolioTotals = useMemo(
    () => computePortfolioTotals(enriched, netContributions),
    [enriched, netContributions]
  )

  const snapshotSaved = useRef(false)

  // Save portfolio history automatically
  useEffect(() => {
    if (enabled && !positionsLoading && !pricesLoading && !contributionsLoading && totals.totalValue > 0 && !snapshotSaved.current) {
      snapshotSaved.current = true
      savePortfolioHistory(totals.totalValue, totals.totalCost).catch(console.error)
    }
  }, [enabled, totals.totalValue, totals.totalCost, positionsLoading, pricesLoading, contributionsLoading])

  // Supabase Realtime: Súper Tiempo Real
  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channelName = `portfolio-realtime-${Math.random()}`
    
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transacciones' }, () => {
        refetchPositions()
        refetchPending()
        refetchContributions()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activos' }, () => {
        refetchPositions()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos_recurrentes' }, () => {})
      .subscribe((status) => {
        setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'disconnected' : 'connecting')
      })

    return () => {
      setRealtimeStatus('disconnected')
      supabase.removeChannel(channel)
    }
  }, [enabled, refetchPositions, refetchPending, refetchContributions])

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
    pendingTxs: pendingTxs ?? [],
    realtimeStatus,
  }
}

export function useHistory() {
  return useQuery({
    queryKey: ["portfolio-history"],
    queryFn: () => import('@/lib/api/assets').then(m => m.fetchHistory()),
    staleTime: 5 * 60 * 1000,
  })
}
