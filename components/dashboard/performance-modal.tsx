"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DailyPnlChart } from "./daily-pnl-chart"
import { PortfolioHistoryChart } from "./portfolio-history-chart"
import { BarChart2, Activity } from "lucide-react"
import { useHistory } from "@/lib/hooks/use-portfolio"
import { format, parseISO, subDays, subMonths, subYears, isAfter } from "date-fns"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"

interface PerformanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPnl24h?: number
  currentTotalValue?: number
  currentTotalCost?: number
}

export type TimeRange = "1D" | "1W" | "1M" | "1Y" | "ALL"

export interface ChartDataPoint {
  timestamp: string
  value: number
  totalInvested: number
  pnl: number
  totalPnl: number
  isFirstPoint: boolean
}

export function PerformanceModal({ open, onOpenChange, currentPnl24h, currentTotalValue, currentTotalCost }: PerformanceModalProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M")
  const { data: snapshots, isLoading } = useHistory()
  const { hideBalances } = usePreferences()

  const processedData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      if (currentTotalValue !== undefined && currentPnl24h !== undefined) {
        const todayStr = new Date().toISOString()
        return [{
          timestamp: todayStr,
          value: currentTotalValue,
          totalInvested: currentTotalValue - currentPnl24h,
          pnl: currentPnl24h,
          totalPnl: currentPnl24h,
          isFirstPoint: true,
        }]
      }
      return []
    }

    const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    
    // Add current real-time point at the end
    if (currentTotalValue !== undefined && currentTotalCost !== undefined) {
       sorted.push({
         timestamp: new Date().toISOString(),
         total_value: currentTotalValue,
         total_invested: currentTotalCost
       })
    }
    
    // Aggregate by day to prevent chart duplication (unless viewing 1D)
    let aggregatedSnaps = sorted
    if (timeRange !== "1D") {
      const byDate = new Map<string, typeof sorted[0]>()
      sorted.forEach(snap => {
        const dateStr = format(parseISO(snap.timestamp), 'yyyy-MM-dd')
        byDate.set(dateStr, snap) // Keeps the latest snap for each day
      })
      aggregatedSnaps = Array.from(byDate.values())
    }

    const allDataPoints: ChartDataPoint[] = []
    
    for (let i = 0; i < aggregatedSnaps.length; i++) {
      const snap = aggregatedSnaps[i]
      const pnlToday = snap.total_value - snap.total_invested
      let pnl = 0
      
      if (i > 0) {
        const prev = allDataPoints[i - 1]
        pnl = pnlToday - prev.totalPnl
      }

      allDataPoints.push({
        timestamp: snap.timestamp,
        value: snap.total_value,
        totalInvested: snap.total_invested,
        pnl: pnl,
        totalPnl: pnlToday,
        isFirstPoint: i === 0,
      })
    }
    
    return allDataPoints
  }, [snapshots, currentTotalValue, currentPnl24h, currentTotalCost, timeRange])

  const filteredData = useMemo(() => {
    if (processedData.length === 0) return []
    if (timeRange === "ALL") return processedData
    
    const now = new Date()
    let startDate = now
    if (timeRange === "1D") startDate = subDays(now, 1)
    if (timeRange === "1W") startDate = subDays(now, 7)
    if (timeRange === "1M") startDate = subMonths(now, 1)
    if (timeRange === "1Y") startDate = subYears(now, 1)

    const filtered = processedData.filter(d => isAfter(parseISO(d.timestamp), startDate))
    
    if (filtered.length < 2 && processedData.length >= 2) {
      return processedData.slice(-2)
    }
    
    return filtered
  }, [processedData, timeRange])

  // Calculate period summary
  const periodSummary = useMemo(() => {
    if (filteredData.length === 0) return { pnl: 0, pnlPercent: 0, endValue: 0 }
    
    const first = filteredData[0]
    const last = filteredData[filteredData.length - 1]
    
    const periodPnl = timeRange === 'ALL' 
      ? last.totalPnl 
      : last.totalPnl - first.totalPnl + first.pnl
    
    const startValue = timeRange === 'ALL' 
      ? last.totalInvested 
      : first.value - first.pnl
      
    const pnlPercent = timeRange === 'ALL'
      ? (last.totalInvested > 0 ? (last.totalPnl / last.totalInvested) * 100 : 0)
      : (startValue > 0 ? (periodPnl / startValue) * 100 : 0)
    
    return {
      pnl: periodPnl,
      pnlPercent,
      endValue: last.value
    }
  }, [filteredData, timeRange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl bg-background/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden">
        <div className="p-6 pb-2 border-b border-border/40">
          <DialogHeader className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                  <BarChart2 className="w-6 h-6 text-blue-500" />
                  Análisis de Rendimiento
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-1">
                  Métricas avanzadas sobre la evolución de tu portfolio.
                </DialogDescription>
              </div>
              
              {/* Time Range Selector */}
              <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50 self-start sm:self-auto">
                {(["1D", "1W", "1M", "1Y", "ALL"] as TimeRange[]).map((tr) => (
                  <button
                    key={tr}
                    onClick={() => setTimeRange(tr)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      timeRange === tr 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    }`}
                  >
                    {tr === '1W' ? '1S' : tr === 'ALL' ? 'TODO' : tr}
                  </button>
                ))}
              </div>
            </div>
          </DialogHeader>

          {/* Period Summary Header */}
          {!isLoading && processedData.length > 0 && (
            <div className="flex items-end gap-6 mb-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Patrimonio</p>
                <p className="text-3xl font-bold font-tabular text-foreground">
                  {hideBalances ? "****" : formatCurrency(periodSummary.endValue)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">En este periodo</p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-xl font-bold font-tabular ${periodSummary.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {periodSummary.pnl >= 0 ? '+' : ''}{hideBalances ? "****" : formatCurrency(periodSummary.pnl)}
                  </p>
                  <p className={`text-sm font-medium ${periodSummary.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ({periodSummary.pnlPercent >= 0 ? '+' : ''}{formatPercent(periodSummary.pnlPercent).replace('+', '')})
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-4 bg-muted/10">
          {isLoading ? (
            <div className="h-[400px] w-full flex items-center justify-center">
              <div className="animate-pulse flex flex-col items-center gap-3 text-muted-foreground/80">
                <Activity className="h-8 w-8 animate-bounce" />
                <p>Calculando evolución...</p>
              </div>
            </div>
          ) : processedData.length === 0 ? (
             <div className="h-[400px] w-full flex items-center justify-center text-muted-foreground text-sm">
                Añade activos a tu portfolio y espera un día para ver tu evolución.
             </div>
          ) : (
            <Tabs defaultValue="patrimonio" className="w-full">
              <div className="flex justify-center mb-6">
                <TabsList className="grid grid-cols-2 w-[400px]">
                  <TabsTrigger value="patrimonio">Evolución del Patrimonio</TabsTrigger>
                  <TabsTrigger value="pnl">PnL Diario</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="patrimonio" className="mt-0">
                <PortfolioHistoryChart chartData={filteredData} />
              </TabsContent>
              <TabsContent value="pnl" className="mt-0">
                <DailyPnlChart chartData={filteredData} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
