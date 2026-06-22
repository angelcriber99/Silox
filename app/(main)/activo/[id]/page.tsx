"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { fetchPosiciones, enrichPositions } from '@/lib/api/assets'
import { fetchPrices } from '@/lib/api/market'
import { createClient } from "@/lib/supabase/client"
import { ActivoDetailClient } from "@/components/asset/activo-detail-client"
import type { EnrichedPosition } from '@/lib/types'

export default function ActivoPage() {
  const params = useParams()
  const id = params.id as string

  const [position, setPosition] = useState<EnrichedPosition | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
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
        setPosition(enrichedPositions[0])

        // Fetch transactions
        const { data: txs } = await supabase
          .from('transacciones')
          .select('*')
          .eq('activo_id', id)
          .order('fecha', { ascending: true })

        setTransactions(txs || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (id) load()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm font-medium">Cargando datos del activo...</p>
        </div>
      </div>
    )
  }

  if (error || !position) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-2">Activo no encontrado</p>
          <p className="text-muted-foreground text-sm">{error || "Este activo no existe en tu cartera."}</p>
        </div>
      </div>
    )
  }

  return <ActivoDetailClient position={position} transactions={transactions} />
}
