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
}

export function PerformanceModal({ open, onOpenChange, currentPnl24h }: PerformanceModalProps) {
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

        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50">
            <TabsTrigger value="daily" className="data-[state=active]:bg-background">
              <BarChart2 className="w-4 h-4 mr-2" />
              PnL Diario
            </TabsTrigger>
            <TabsTrigger value="drawdown" className="data-[state=active]:bg-background">
              <TrendingDown className="w-4 h-4 mr-2 text-rose-400" />
              Drawdown
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="mt-0">
            <DailyPnlChart currentPnl24h={currentPnl24h} />
          </TabsContent>
          
          <TabsContent value="drawdown" className="mt-0">
            <DrawdownChart />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
