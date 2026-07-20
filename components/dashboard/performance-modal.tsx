"use client"

import { useMemo, useState } from "react"
import { Activity, BarChart2, CircleDollarSign, Landmark, TrendingUp, WalletCards } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useHistory } from "@/lib/hooks/use-portfolio"
import { usePreferences } from "@/lib/stores/use-preferences"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import {
  buildPerformanceSeries,
  filterPerformanceSeries,
  summarizePerformance,
  type PerformancePoint,
  type PerformanceRange,
} from "@/lib/utils/performance-history"
import type { EnrichedPosition } from "@/lib/types"

import { DailyPnlChart } from "./daily-pnl-chart"
import { DistributionExtended } from "./distribution-extended"
import { PortfolioHistoryChart } from "./portfolio-history-chart"

interface PerformanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  positions?: EnrichedPosition[]
  currentDailyPnl?: number
  currentDailyPnlPercent?: number
  currentDailyCoverage?: number
  currentPositionCount?: number
  currentTotalValue?: number
  currentTotalCost?: number
  currentTotalPnl?: number
  currentTotalPnlPercent?: number
}

export type TimeRange = PerformanceRange
export type ChartDataPoint = PerformancePoint

const RANGES: TimeRange[] = ["1D", "1W", "1M", "1Y", "ALL"]

function pnlTone(value: number): "positive" | "negative" | "neutral" {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral"
}

function pnlTextClass(value: number): string {
  return value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-foreground"
}

function RangeSelector({ value, onChange }: { value: TimeRange; onChange: (range: TimeRange) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-border/60 bg-background/80 p-1">
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={`min-w-10 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            value === range
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {range === "1W" ? "1S" : range === "ALL" ? "TODO" : range}
        </button>
      ))}
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string
  value: string
  detail: string
  icon: typeof WalletCards
  tone?: "positive" | "negative" | "neutral"
}) {
  const toneClass = tone === "positive"
    ? "text-emerald-400"
    : tone === "negative"
      ? "text-rose-400"
      : "text-foreground"

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className={`truncate text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export function PerformanceModal({
  open,
  onOpenChange,
  positions = [],
  currentDailyPnl = 0,
  currentDailyPnlPercent = 0,
  currentDailyCoverage = 0,
  currentPositionCount = 0,
  currentTotalValue = 0,
  currentTotalCost = 0,
  currentTotalPnl = currentTotalValue - currentTotalCost,
  currentTotalPnlPercent = currentTotalCost > 0 ? ((currentTotalValue - currentTotalCost) / currentTotalCost) * 100 : 0,
}: PerformanceModalProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M")
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null)
  const { data: snapshots = [], isLoading } = useHistory({ enabled: open })
  const { hideBalances } = usePreferences()

  const processedData = useMemo(() => buildPerformanceSeries(snapshots, {
    timestamp: new Date().toISOString(),
    total_value: currentTotalValue,
    total_invested: currentTotalCost,
  }), [snapshots, currentTotalValue, currentTotalCost])

  const filteredData = useMemo(
    () => filterPerformanceSeries(processedData, timeRange),
    [processedData, timeRange],
  )

  const selectedData = useMemo(() => {
    if (!hoveredPoint) return filteredData
    const hoveredTime = new Date(hoveredPoint.timestamp).getTime()
    return filteredData.filter((point) => new Date(point.timestamp).getTime() <= hoveredTime)
  }, [filteredData, hoveredPoint])

  const period = useMemo(
    () => summarizePerformance(selectedData, timeRange),
    [selectedData, timeRange],
  )
  const displayedPeriod = timeRange === "1D" && !hoveredPoint
    ? { ...period, profit: currentDailyPnl, profitPercent: currentDailyPnlPercent }
    : period

  const dailyCoverageDetail = currentPositionCount > 0 && currentDailyCoverage < currentPositionCount
    ? `Día completo · cobertura ${currentDailyCoverage}/${currentPositionCount} posiciones`
    : "Premercado + regular + postmercado"
  const rangeLabel = timeRange === "1D"
    ? "Día completo: pre + regular + post"
    : timeRange === "ALL"
      ? "Desde la primera aportación registrada"
      : `Resultado ajustado por flujos · ${timeRange === "1W" ? "1 semana" : timeRange === "1M" ? "1 mes" : "1 año"}`

  const money = (value: number, signed = false) => hideBalances
    ? "••••"
    : `${signed && value >= 0 ? "+" : ""}${formatCurrency(value)}`
  const percent = (value: number) => hideBalances ? "•••" : formatPercent(value)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border/60 bg-background/98 p-0 sm:max-w-6xl">
        <Tabs defaultValue="evolucion" className="flex min-h-[680px] w-full flex-col">
          <div className="border-b border-border/50 px-5 pb-5 pt-6 sm:px-7">
            <DialogHeader>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 text-primary">
                      <BarChart2 className="h-5 w-5" />
                    </span>
                    Evolución de la cartera
                  </DialogTitle>
                  <DialogDescription className="mt-2 max-w-2xl">
                    Valor, capital aportado y rendimiento contrastados. Las entradas y salidas de dinero no se contabilizan como P&amp;L.
                  </DialogDescription>
                </div>
                <TabsList className="grid h-10 w-full grid-cols-3 lg:w-[430px]">
                  <TabsTrigger value="evolucion">Evolución</TabsTrigger>
                  <TabsTrigger value="diario">P&amp;L diario</TabsTrigger>
                  <TabsTrigger value="distribucion">Distribución</TabsTrigger>
                </TabsList>
              </div>
            </DialogHeader>

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Patrimonio actual"
                value={money(currentTotalValue)}
                detail="Valor de mercado en EUR"
                icon={WalletCards}
              />
              <MetricCard
                label="P&L de hoy"
                value={`${money(currentDailyPnl, true)} · ${percent(currentDailyPnlPercent)}`}
                detail={dailyCoverageDetail}
                icon={TrendingUp}
                tone={pnlTone(currentDailyPnl)}
              />
              <MetricCard
                label="P&L total"
                value={`${money(currentTotalPnl, true)} · ${percent(currentTotalPnlPercent)}`}
                detail="Frente al capital neto aportado"
                icon={CircleDollarSign}
                tone={pnlTone(currentTotalPnl)}
              />
              <MetricCard
                label="Capital neto"
                value={money(currentTotalCost)}
                detail="Compras − ventas − dividendos netos"
                icon={Landmark}
              />
            </div>
          </div>

          <div className="flex-1 bg-muted/10 p-4 sm:p-6">
            <TabsContent value="evolucion" className="mt-0">
              <section className="rounded-2xl border border-border/60 bg-card/55 p-4 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Resultado del periodo</p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-2">
                        <p className={`text-2xl font-bold tabular-nums ${pnlTextClass(displayedPeriod.profit)}`}>
                          {money(displayedPeriod.profit, true)}
                        </p>
                        <p className={`text-sm font-semibold ${pnlTextClass(displayedPeriod.profit)}`}>
                          {percent(displayedPeriod.profitPercent)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{rangeLabel}</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-[120px] text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Total Histórico</span>
                        <span className={`text-sm font-bold tabular-nums ${pnlTextClass(currentTotalPnl)}`}>
                          {money(currentTotalPnl, true)}
                        </span>
                        <span className="text-muted-foreground text-xs opacity-50">•</span>
                        <span className={`text-sm font-semibold tabular-nums ${pnlTextClass(currentTotalPnl)}`}>
                          {percent(currentTotalPnlPercent)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-[120px] text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Aportado Neto</span>
                        <span className="text-sm font-bold tabular-nums text-foreground">
                          {money(currentTotalCost)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <RangeSelector value={timeRange} onChange={(range) => { setTimeRange(range); setHoveredPoint(null) }} />
                </div>

                {isLoading ? (
                  <div className="grid h-[360px] place-items-center text-muted-foreground">
                    <div className="flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" /> Verificando el histórico…</div>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="grid h-[360px] place-items-center text-center text-sm text-muted-foreground">
                    Todavía no hay puntos reales para este periodo. No se mostrarán datos inventados.
                  </div>
                ) : (
                  <div className="h-[380px] w-full">
                    <PortfolioHistoryChart chartData={filteredData} onHoverChange={setHoveredPoint} />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-primary" /> Valor de cartera</span>
                  <span className="flex items-center gap-2"><span className="h-0 w-5 border-t border-dashed border-muted-foreground" /> Capital neto aportado</span>
                  <span>Último punto en tiempo real; histórico cada 15 min mientras Silox está abierto.</span>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="diario" className="mt-0">
              <section className="rounded-2xl border border-border/60 bg-card/55 p-4 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">Beneficio o pérdida por día</p>
                    <p className="mt-1 text-xs text-muted-foreground">Cada barra suma premercado, sesión regular y postmercado, descontando aportaciones y retiradas.</p>
                  </div>
                  <RangeSelector value={timeRange} onChange={(range) => { setTimeRange(range); setHoveredPoint(null) }} />
                </div>
                {isLoading ? (
                  <div className="grid h-[360px] place-items-center text-muted-foreground">Calculando resultados diarios…</div>
                ) : filteredData.length === 0 ? (
                  <div className="grid h-[360px] place-items-center text-sm text-muted-foreground">Sin cierres reales en este periodo.</div>
                ) : (
                  <DailyPnlChart
                    chartData={processedData}
                    range={timeRange}
                    currentDailyPnl={currentDailyPnl}
                    currentDailyPnlPercent={currentDailyPnlPercent}
                  />
                )}
              </section>
            </TabsContent>

            <TabsContent value="distribucion" className="mt-0">
              <section className="min-h-[470px] rounded-2xl border border-border/60 bg-card/55 p-4 shadow-sm sm:p-6">
                <DistributionExtended positions={positions} />
              </section>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
