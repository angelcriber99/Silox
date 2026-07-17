"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { fetchPosiciones, enrichPositions } from '@/lib/api/assets'
import { fetchPrices } from '@/lib/api/market'
import { createClient } from "@/lib/supabase/client"
import { FundDetailClient } from "@/components/asset/fund-detail-client"
import { StockDetailClient } from "@/components/asset/stock-detail-client"
import { CryptoDetailClient } from "@/components/asset/crypto-detail-client"
import { EtfDetailClient } from "@/components/asset/etf-detail-client"
import { LiquidityDetailClient } from "@/components/asset/liquidity-detail-client"
import type { EnrichedPosition } from '@/lib/types'
import type { RawTransaction } from '@/components/asset/detail/use-asset-calculations'
import type { AssetDetails } from '@/lib/actions/market'

export default function ActivoPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''

  const [position, setPosition] = useState<EnrichedPosition | null>(null)
  const [assetDetails, setAssetDetails] = useState<AssetDetails | null>(null)
  const [transactions, setTransactions] = useState<RawTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const supabase = createClient()

        // Fetch position data
        const rawPositions = await fetchPosiciones()
        const rawPosition = rawPositions.find((p) => p.activo_id === id)

        if (!rawPosition) {
          setError("No se encontró este activo")
          return
        }

        const pricePayload = await fetchPrices([rawPosition.ticker])
        const enrichedPositions = enrichPositions([rawPosition], pricePayload)
        
        let pos = enrichedPositions[0]
        let details: AssetDetails | null = null

        if (rawPosition.tipo === "Acción" || rawPosition.tipo === "ETF") {
          const { fetchAssetDetails } = await import('@/lib/actions/market')
          details = await fetchAssetDetails(rawPosition.ticker)
        }

        // Fetch transactions
        const { data: txs, error: transactionsError } = await supabase
          .from('transacciones')
          .select('*')
          .eq('activo_id', id)
          .order('fecha', { ascending: true })

        if (transactionsError) throw transactionsError

        let finalTxs = txs || []

        // Convert everything to EUR for consistent display
        if (pos.moneda !== 'EUR') {
          const fxRate = (pos.precio_actual_nativo && pos.precio_actual && pos.precio_actual > 0)
            ? (pos.precio_actual_nativo / pos.precio_actual)
            : 1;

          finalTxs = finalTxs.map(tx => ({
            ...tx,
            precio_unitario: Number(tx.precio_unitario) / fxRate,
            comision: Number(tx.comision) / fxRate,
          }))

          if (details) {
            details = {
              ...details,

              fiftyTwoWeekHigh: details.fiftyTwoWeekHigh ? details.fiftyTwoWeekHigh / fxRate : undefined,
              fiftyTwoWeekLow: details.fiftyTwoWeekLow ? details.fiftyTwoWeekLow / fxRate : undefined,

              twoHundredDayAverage: details.twoHundredDayAverage ? details.twoHundredDayAverage / fxRate : undefined,
              targetMeanPrice: details.targetMeanPrice ? details.targetMeanPrice / fxRate : undefined,
            }
          }

          pos = {
            ...pos,
            moneda: 'EUR',
            valor_actual_nativo: pos.valor_actual,
            // Keep change_amount_24h_nativo intact for the header
            coste_total: pos.coste_total_eur,
            precio_medio: pos.unidades > 0 ? (pos.coste_total_eur / pos.unidades) : pos.coste_total_eur,
          }
        }

        setPosition(pos)
        if (details) setAssetDetails(details)
        setTransactions(finalTxs)
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : 'Error al cargar el activo')
      } finally {
        setLoading(false)
      }
    }

    if (id) load()
  }, [id])

  if (loading) {
    return (
      <div className="h-[70vh] w-full bg-background flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm font-medium">Cargando datos del activo...</p>
        </div>
      </div>
    )
  }

  if (error || !position) {
    return (
      <div className="h-[70vh] w-full bg-background flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground mb-2">Activo no encontrado</p>
          <p className="text-muted-foreground text-sm">{error || "Este activo no existe en tu cartera."}</p>
        </div>
      </div>
    )
  }

  if (position.tipo === "Liquidez") {
    return <LiquidityDetailClient position={position} transactions={transactions} />
  } else if (position.tipo === "Acción") {
    return <StockDetailClient position={position} transactions={transactions} assetDetails={assetDetails} />
  } else if (position.tipo === "Crypto" || position.tipo === "Metal") {
    return <CryptoDetailClient position={position} transactions={transactions} />
  } else if (position.tipo === "ETF") {
    return <EtfDetailClient position={position} transactions={transactions} assetDetails={assetDetails} />
  }

  // Default for "Fondo Indexado", "Fondo Monetario", and any other unrecognized type
  return <FundDetailClient position={position} transactions={transactions} />
}
