"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useEffect, useRef } from "react"
import type { EnrichedPosition, PortfolioTotals } from '@/lib/types'
import { fetchPosiciones, enrichPositions, computePortfolioTotals } from '@/lib/api/assets'
import { saveDailySnapshotAction } from '@/lib/actions/assets'
import { usePrices } from "./use-prices"
import { createClient } from '@/lib/supabase/client'
import { fetchPendingTransactions } from '@/lib/api/transactions'

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: fetchPosiciones,
    staleTime: 60_000, // 1 minute, but invalidated via websockets instantly
  })
}

export function usePendingTransactions() {
  return useQuery({
    queryKey: ["pending-transactions"],
    queryFn: fetchPendingTransactions,
    staleTime: 60_000,
  })
}

export function usePortfolio() {
  const {
    data: positions,
    isLoading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = usePositions()
  
  const {
    data: pendingTxs,
    refetch: refetchPending,
  } = usePendingTransactions()

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
    const enrichedList = enrichPositions(positions, pricePayload ?? { prices: {} })
    
    if (pendingTxs && pendingTxs.length > 0) {
      let pendingCashChange = 0
      pendingTxs.forEach(tx => {
        if (tx.tipo_operacion === 'Venta') {
          pendingCashChange += (tx.cantidad * tx.precio_unitario) - (tx.comision || 0)
        } else if (tx.tipo_operacion === 'Compra') {
          pendingCashChange -= (tx.cantidad * tx.precio_unitario) + (tx.comision || 0)
        }
      })
      
      if (pendingCashChange !== 0) {
        const cashPos = enrichedList.find(p => p.tipo === 'Liquidez')
        if (cashPos) {
          cashPos.valor_actual = (cashPos.valor_actual || 0) + pendingCashChange
          cashPos.valor_actual_nativo = (cashPos.valor_actual_nativo || 0) + pendingCashChange
        }
      }
    }
    
    return enrichedList
  }, [positions, pricePayload, pendingTxs])

  const totals: PortfolioTotals = useMemo(
    () => computePortfolioTotals(enriched),
    [enriched]
  )

  const snapshotSaved = useRef(false)

  // Save daily snapshot automatically
  useEffect(() => {
    if (!positionsLoading && !pricesLoading && totals.totalValue > 0 && !snapshotSaved.current) {
      snapshotSaved.current = true
      saveDailySnapshotAction(totals.totalValue, totals.totalCost).catch(console.error)
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
        refetchPending()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetchPositions, refetchPending])

  const refetch = async () => {
    await refetchPositions()
    await refetchPending()
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
    marketState: pricePayload?.marketState ?? 'CLOSED',
  }
}

export function useSnapshots() {
  return useQuery({
    queryKey: ["portfolio-snapshots"],
    queryFn: () => import('@/lib/api/assets').then(m => m.fetchSnapshots()),
    staleTime: 5 * 60 * 1000,
  })
}
