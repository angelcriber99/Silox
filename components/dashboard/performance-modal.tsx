"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DailyPnlChart } from "./daily-pnl-chart"
import { TrendingUp, BarChart2 } from "lucide-react"

interface PerformanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PerformanceModal({ open, onOpenChange }: PerformanceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <BarChart2 className="w-6 h-6 text-blue-500" />
            Rendimiento Diario
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Variación neta (ganancias o pérdidas) de tu portfolio día a día.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full">
          <DailyPnlChart />
        </div>
      </DialogContent>
    </Dialog>
  )
}
