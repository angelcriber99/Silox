"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { FundDetailClient } from "@/components/asset/fund-detail-client"
import { StockDetailClient } from "@/components/asset/stock-detail-client"
import { CryptoDetailClient } from "@/components/asset/crypto-detail-client"
import { EtfDetailClient } from "@/components/asset/etf-detail-client"
import { LiquidityDetailClient } from "@/components/asset/liquidity-detail-client"
import { fetchAssetDetails } from "@/lib/actions/market"
import { enrichPositions } from "@/lib/api/assets"
import { fetchAssetTransactions } from "@/lib/api/transactions"
import { usePositions } from "@/lib/hooks/use-portfolio"
import { usePrices } from "@/lib/hooks/use-prices"
import { createClient } from "@/lib/supabase/client"

type RealtimeStatus = "connecting" | "connected" | "disconnected"

export default function ActivoPage() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const queryClient = useQueryClient()
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting")

  const positionsQuery = usePositions({ enabled: Boolean(id) })
  const rawPosition = useMemo(
    () => positionsQuery.data?.find((item) => item.activo_id === id) ?? null,
    [id, positionsQuery.data],
  )
  const priceQuery = usePrices(rawPosition ? [rawPosition.ticker] : [], {
    enabled: Boolean(rawPosition),
  })
  const position = useMemo(
    () => rawPosition
      ? enrichPositions([rawPosition], priceQuery.data ?? { prices: {} })[0]
      : null,
    [priceQuery.data, rawPosition],
  )

  const transactionsQuery = useQuery({
    queryKey: ["asset-transactions", id],
    queryFn: () => fetchAssetTransactions(id),
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  })

  const supportsFundamentals = rawPosition?.tipo === "Acción" || rawPosition?.tipo === "ETF"
  const detailsQuery = useQuery({
    queryKey: ["asset-details", rawPosition?.ticker],
    queryFn: () => fetchAssetDetails(rawPosition!.ticker),
    enabled: Boolean(rawPosition && supportsFundamentals),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!id) return

    const supabase = createClient()
    const channel = supabase
      .channel(`asset-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transacciones" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["asset-transactions", id] })
          queryClient.invalidateQueries({ queryKey: ["positions"] })
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activos", filter: `id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["positions"] }),
      )
      .subscribe((status) => {
        setRealtimeStatus(
          status === "SUBSCRIBED"
            ? "connected"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "disconnected"
              : "connecting",
        )
      })

    return () => {
      setRealtimeStatus("disconnected")
      void supabase.removeChannel(channel)
    }
  }, [id, queryClient])

  const loading = positionsQuery.isLoading || (rawPosition && priceQuery.isLoading) || transactionsQuery.isLoading
  const error = positionsQuery.error || priceQuery.error || transactionsQuery.error

  if (loading) {
    return (
      <div className="flex h-[70vh] w-full flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Sincronizando el activo...</p>
        </div>
      </div>
    )
  }

  if (error || !position) {
    return (
      <div className="flex h-[70vh] w-full flex-col items-center justify-center bg-background">
        <div className="text-center">
          <p className="mb-2 text-2xl font-bold text-foreground">Activo no encontrado</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Este activo no existe en tu cartera."}
          </p>
        </div>
      </div>
    )
  }

  const transactions = transactionsQuery.data ?? []
  const liveProps = {
    position,
    transactions,
    realtimeStatus,
    pricesUpdatedAt: priceQuery.dataUpdatedAt,
  }

  if (position.tipo === "Liquidez") {
    return <LiquidityDetailClient position={position} transactions={transactions} />
  }
  if (position.tipo === "Acción") {
    return <StockDetailClient {...liveProps} assetDetails={detailsQuery.data} />
  }
  if (position.tipo === "Crypto" || position.tipo === "Metal") {
    return <CryptoDetailClient position={position} transactions={transactions} />
  }
  if (position.tipo === "ETF") {
    return <EtfDetailClient position={position} transactions={transactions} assetDetails={detailsQuery.data} />
  }
  return <FundDetailClient position={position} transactions={transactions} />
}
