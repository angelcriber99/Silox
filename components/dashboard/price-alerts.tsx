"use client"

import { Bell } from "lucide-react"

import { AlertsWorkspace } from "@/components/alerts/alerts-workspace"
import { usePriceAlertNotifications } from "@/components/dashboard/use-price-alert-notifications"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAlerts } from "@/lib/hooks/use-alerts"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import type { EnrichedPosition } from "@/lib/types"

interface PriceAlertsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTicker?: string
  positions?: EnrichedPosition[]
  checkNotifications?: boolean
}

export function PriceAlerts({
  open,
  onOpenChange,
  initialTicker,
  positions: providedPositions,
  checkNotifications = true,
}: PriceAlertsProps) {
  const { positions: fetchedPositions } = usePortfolio({ enabled: !providedPositions })
  const positions = providedPositions ?? fetchedPositions
  const { alerts, removeAlert } = useAlerts()
  usePriceAlertNotifications(checkNotifications ? positions : [], alerts, removeAlert)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[94vw] gap-0 border-l border-border/70 bg-background p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 p-5 pr-14">
          <SheetTitle className="flex items-center gap-2 text-lg font-black tracking-tight"><Bell className="size-4.5 text-primary" />Alertas de precio</SheetTitle>
          <SheetDescription>Activa objetivos y deja que Silox vigile el mercado.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <AlertsWorkspace positions={positions} compact initialTicker={initialTicker} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
