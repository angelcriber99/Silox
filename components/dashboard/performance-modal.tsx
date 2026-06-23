"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DailyPnlChart } from "./daily-pnl-chart"
import { DrawdownChart } from "./drawdown-chart"
import { TrendingDown, BarChart2 } from "lucide-react"

interface PerformanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPnl24h?: number
  currentTotalValue?: number
}

export function PerformanceModal({ open, onOpenChange, currentPnl24h, currentTotalValue }: PerformanceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <BarChart2 className="w-6 h-6 text-blue-500" />
            Análisis de Rendimiento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Métricas avanzadas sobre la evolución de tu portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <DailyPnlChart currentPnl24h={currentPnl24h} currentTotalValue={currentTotalValue} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
