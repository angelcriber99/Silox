"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils/formatters"
import type { EnrichedPosition } from "@/lib/types"
import type { PriceAlert } from "@/lib/api/alerts"

export function usePriceAlertNotifications(
  positions: EnrichedPosition[],
  alerts: PriceAlert[],
  removeAlert: (id: string) => Promise<unknown> | void
) {
  const triggeredIdsRef = useRef(new Set<string>())

  useEffect(() => {
    if (positions.length === 0) return

    let triggeredCount = 0

    alerts.forEach((alert) => {
      if (alert.triggered) return
      if (triggeredIdsRef.current.has(alert.id)) return

      const pos = positions.find(p => p.ticker.toUpperCase() === alert.ticker.toUpperCase())
      if (!pos || pos.precio_actual === null) return

      const currentPrice = pos.precio_actual_nativo !== null ? pos.precio_actual_nativo : pos.precio_actual
      if (currentPrice === null) return

      const shouldTrigger =
        (alert.condition === 'above' && currentPrice >= alert.target_price) ||
        (alert.condition === 'below' && currentPrice <= alert.target_price)

      if (shouldTrigger) {
        triggeredIdsRef.current.add(alert.id)
        removeAlert(alert.id)
        triggeredCount++

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("¡Alerta de Silox!", {
            body: `${alert.ticker} ha cruzado tu objetivo de ${formatCurrency(alert.target_price, pos.moneda || 'EUR')}. Precio actual: ${formatCurrency(currentPrice, pos.moneda || 'EUR')}`,
            icon: '/icons/icon-192.webp'
          })
        }
      }
    })

    if (triggeredCount > 0) {
      toast.success(`${triggeredCount} alerta(s) de precio alcanzadas`)
    }
  }, [positions, alerts, removeAlert])
}
