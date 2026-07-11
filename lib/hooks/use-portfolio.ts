"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useEffect, useRef } from "react"
import type { EnrichedPosition, PortfolioTotals } from '@/lib/types'
import { fetchPosiciones, enrichPositions, computePortfolioTotals } from '@/lib/api/assets'
import { savePortfolioHistory } from '@/lib/api/assets'
import { usePrices } from "./use-prices"
import { createClient } from '@/lib/supabase/client'
import { fetchPendingTransactions } from '@/lib/api/transactions'

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

export function usePortfolio(options?: { enabled?: boolean }) {
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

  const adjustedPositions = useMemo(() => {
    if (!positions) return []
    const pending = pendingTxs ?? []
    
    return positions.map(pos => {
      const posPending = pending.filter(tx => tx.activo?.ticker === pos.ticker)
      if (posPending.length === 0) return pos
      
      let newUnidades = pos.unidades
      let newCoste = pos.coste_total
      
      for (const tx of posPending) {
        if (tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') {
          newUnidades -= tx.cantidad
          newCoste -= (tx.cantidad * tx.precio_unitario)
        } else if (tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida') {
          newUnidades += tx.cantidad
          newCoste += (tx.cantidad * tx.precio_unitario)
        }
      }
      
      return {
        ...pos,
        unidades: newUnidades,
        coste_total: newCoste
      }
    })
  }, [positions, pendingTxs])

  const tickers = useMemo(
    () => adjustedPositions.filter((p) => p.unidades > 0).map((p) => p.ticker),
    [adjustedPositions]
  )

  const {
    data: pricePayload,
    isLoading: pricesLoading,
    refetch: refetchPrices,
    dataUpdatedAt: pricesUpdatedAt,
  } = usePrices(tickers, { enabled })

  const enriched: EnrichedPosition[] = useMemo(() => {
    if (!adjustedPositions) return []
    const enrichedList = enrichPositions(adjustedPositions, pricePayload ?? { prices: {} })
    return enrichedList
  }, [adjustedPositions, pricePayload])

  const totals: PortfolioTotals = useMemo(
    () => computePortfolioTotals(enriched),
    [enriched]
  )

  const snapshotSaved = useRef(false)

  // Save portfolio history automatically
  useEffect(() => {
    if (enabled && !positionsLoading && !pricesLoading && totals.totalValue > 0 && !snapshotSaved.current) {
      snapshotSaved.current = true
      savePortfolioHistory(totals.totalValue, totals.totalCost).catch(console.error)
    }
  }, [enabled, totals.totalValue, totals.totalCost, positionsLoading, pricesLoading])

  // Supabase Realtime: Súper Tiempo Real
  useEffect(() => {
    if (!enabled) return

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
  }, [enabled, refetchPositions, refetchPending])

  const refetch = async () => {
    await Promise.all([
      refetchPositions(),
      refetchPending(),
      refetchPrices(),
    ])
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
    pendingTxs: pendingTxs ?? [],
  }
}

export function useHistory() {
  return useQuery({
    queryKey: ["portfolio-history"],
    queryFn: () => import('@/lib/api/assets').then(m => m.fetchHistory()),
    staleTime: 5 * 60 * 1000,
  })
}
