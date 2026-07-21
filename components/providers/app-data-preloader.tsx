"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { fetchAlerts } from "@/lib/api/alerts"
import { fetchActivos, fetchHistory, fetchPortfolioFunding, fetchPosiciones } from "@/lib/api/assets"
import { fetchPendingTransactions, fetchTransacciones } from "@/lib/api/transactions"

const PRIMARY_STALE_TIME = 60_000
const SECONDARY_STALE_TIME = 5 * 60_000
const ROUTES_TO_WARM = ["/", "/analisis", "/movimientos", "/radar", "/historial", "/settings"]

async function fetchRadar() {
  const response = await fetch("/api/mobile/v1/radar", { cache: "no-store" })
  if (!response.ok) throw new Error(`Radar API returned ${response.status}`)
  const payload = await response.json()
  return payload.data
}

function afterFirstPaint(callback: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1_500 })
    return () => window.cancelIdleCallback(id)
  }
  const id = globalThis.setTimeout(callback, 250)
  return () => globalThis.clearTimeout(id)
}

/**
 * Warms the shared React Query cache in two phases. The first phase contains
 * only data needed for the portfolio and quick-add flows; the rest starts once
 * the browser is idle so it cannot delay interactivity.
 */
export function AppDataPreloader() {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: ["positions"], queryFn: fetchPosiciones, staleTime: PRIMARY_STALE_TIME }),
      queryClient.prefetchQuery({ queryKey: ["pending-transactions"], queryFn: fetchPendingTransactions, staleTime: PRIMARY_STALE_TIME }),
      queryClient.prefetchQuery({ queryKey: ["portfolio-funding"], queryFn: fetchPortfolioFunding, staleTime: SECONDARY_STALE_TIME }),
      queryClient.prefetchQuery({ queryKey: ["activos"], queryFn: fetchActivos, staleTime: SECONDARY_STALE_TIME }),
    ])

    const cancelIdle = afterFirstPaint(() => {
      ROUTES_TO_WARM.forEach((route) => router.prefetch(route))
      void Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ["transactions", 1000],
          queryFn: () => fetchTransacciones(1000),
          staleTime: PRIMARY_STALE_TIME,
        }),
        queryClient.prefetchQuery({
          queryKey: ["portfolio-history"],
          queryFn: fetchHistory,
          staleTime: SECONDARY_STALE_TIME,
        }),
        queryClient.prefetchQuery({ queryKey: ["alerts"], queryFn: fetchAlerts, staleTime: 2 * 60_000 }),
        queryClient.prefetchQuery({
          queryKey: ["portfolio-radar-v2"],
          queryFn: fetchRadar,
          staleTime: SECONDARY_STALE_TIME,
        }),
        import("@/components/analysis/comprehensive-analysis"),
        import("@/components/analysis/projections"),
      ])
    })

    return cancelIdle
  }, [queryClient, router])

  return null
}
