"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { createClient } from '@/lib/supabase/client'
import type { Alerta } from '@/lib/types'
import { toast } from "sonner"

async function fetchAlertas() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('alertas')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(50)

  if (error) throw error
  return data as Alerta[]
}

export function useAlertas() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["alertas"],
    queryFn: fetchAlertas,
    staleTime: 60_000,
  })

  // Supabase Realtime para Alertas
  useEffect(() => {
    const supabase = createClient()
    const channelName = `alertas-realtime-${Math.random()}`
    
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, (payload) => {
        const newAlerta = payload.new as Alerta
        
        // Mostrar notificación
        if (newAlerta.tipo === 'chat') {
          toast.success(`NUEVA ALERTA: ${newAlerta.accion} ${newAlerta.ticker}`, {
            description: `@ $${newAlerta.precio}`,
            duration: 10000,
          })
        } else {
          toast.info(`Nuevo post de The Long Investor`, {
            description: newAlerta.ticker ? `Ticker: ${newAlerta.ticker}` : 'Revisa el panel de alertas',
            duration: 10000,
          })
        }

        // Refrescar caché
        queryClient.invalidateQueries({ queryKey: ["alertas"] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return query
}
