"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { createClient } from "@/lib/supabase/client"

/** One Supabase channel for the entire authenticated shell. */
export function PortfolioRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`portfolio-shell-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transacciones" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["positions"] })
        void queryClient.invalidateQueries({ queryKey: ["transactions"] })
        void queryClient.invalidateQueries({ queryKey: ["pending-transactions"] })
        void queryClient.invalidateQueries({ queryKey: ["portfolio-funding"] })
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activos" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["positions"] })
        void queryClient.invalidateQueries({ queryKey: ["activos"] })
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos_recurrentes" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["upcoming-events"] })
        void queryClient.invalidateQueries({ queryKey: ["portfolio-radar-v2"] })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return null
}
