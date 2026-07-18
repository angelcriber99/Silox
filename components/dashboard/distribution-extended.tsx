"use client"

import { useMemo, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { computePortfolioTotals } from "@/lib/api/assets"
import { usePreferences } from "@/lib/stores/use-preferences"
import { PieChart as PieChartIcon, BarChart3 } from "lucide-react"
import { useTranslations } from "next-intl"

import { CategoryDrilldownModal } from "@/components/dashboard/category-drilldown-modal"

interface AllocationChartProps {
  positions: EnrichedPosition[]
}

const TYPE_COLORS: Record<string, string> = {
  ETF: "#3b82f6",
  "Fondo Indexado": "#8b5cf6",
  "Fondo Monetario": "#06b6d4",
  Acción: "#f59e0b",
  Crypto: "#f97316",
  Metal: "#a8a29e",
  Liquidez: "#a1a1aa",
}

const STRATEGY_COLORS: Record<string, string> = {
  Core: "#3b82f6",
  Satellite: "#8b5cf6",
}

type GroupBy = "tipo" | "estrategia"
type ViewMode = "composition" | "performance"

interface ChartDatum {
  name: string
  originalName: string
  value: number
  color: string
  percent: number
  dailyPnlPercent: number
  dailyPnlAmount: number
}

export function DistributionExtended({ positions }: AllocationChartProps) {
  const { hideBalances } = usePreferences()
  const [viewMode, setViewMode] = useState<ViewMode>("composition")
  const [groupBy, setGroupBy] = useState<GroupBy>("tipo")
  const [drilldownModalOpen, setDrilldownModalOpen] = useState(false)
  const [drilldownCategoryName, setDrilldownCategoryName] = useState("")
  const [drilldownOriginalName, setDrilldownOriginalName] = useState("")
  const totals = useMemo(() => computePortfolioTotals(positions), [positions])
  const t = useTranslations('Dashboard')

  const chartData = useMemo(() => {
    const typeTranslationKeys: Record<string, string> = {
      "ETF": "type_etf",
      "Fondo Indexado": "type_index_fund",
      "Fondo Monetario": "type_money_market",
      "Acción": "type_stock",
      "Crypto": "type_crypto",
      "Metal": "type_metal",
    }
    const groups = new Map<string, { value: number; dailyPnl: number; dailyBaseline: number }>()
    const colors = groupBy === "tipo" ? TYPE_COLORS : STRATEGY_COLORS

    for (const p of positions) {
      if (p.tipo === 'Liquidez' || p.tipo === 'Fondo Monetario') continue;
      
      const key = groupBy === "tipo" ? p.tipo : p.estrategia
      const value = p.valor_actual ?? p.coste_total
      const dailyPercent = p.daily_change_percent_24h
      const dailyFactor = typeof dailyPercent === "number" ? 1 + dailyPercent / 100 : 0
      const hasDailyPerformance = Number.isFinite(dailyFactor) && dailyFactor > 0 && p.change_amount_24h !== null
      const dailyBaseline = hasDailyPerformance
        ? (p.daily_performance_base_eur ?? (value / dailyFactor))
        : 0
      const dailyPnl = hasDailyPerformance ? (p.change_amount_24h ?? 0) : 0

      if (value > 0) {
        const existing = groups.get(key) ?? { value: 0, dailyPnl: 0, dailyBaseline: 0 }
        groups.set(key, {
          value: existing.value + value,
          dailyPnl: existing.dailyPnl + dailyPnl,
          dailyBaseline: existing.dailyBaseline + dailyBaseline,
        })
      }
    }

    const total = Array.from(groups.values()).reduce((a, b) => a + b.value, 0)
    const data: ChartDatum[] = Array.from(groups.entries())
      .filter(([, groupData]) => groupData.value > 0)
      .map(([name, groupData]) => ({
        name: groupBy === "tipo" && typeTranslationKeys[name] ? t(typeTranslationKeys[name]) : name,
        originalName: name,
        value: groupData.value,
        color: colors[name] ?? "#71717a",
        percent: total > 0 ? (groupData.value / total) * 100 : 0,
        dailyPnlPercent: groupData.dailyBaseline > 0 ? (groupData.dailyPnl / groupData.dailyBaseline) * 100 : 0,
        dailyPnlAmount: groupData.dailyPnl
      }))
      .sort((a, b) => b.value - a.value)

    return { data, total }
  }, [positions, groupBy, t])

  const hasData = chartData.data.length > 0

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("composition")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 flex items-center gap-1.5 ${
                viewMode === "composition"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Composición</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("performance")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 flex items-center gap-1.5 ${
                viewMode === "performance"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rendimiento Hoy</span>
            </button>
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setGroupBy("tipo")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
                groupBy === "tipo"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t('dist_type')}
            </button>
            <button
              type="button"
              onClick={() => setGroupBy("estrategia")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
                groupBy === "estrategia"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t('dist_strategy')}
            </button>
          </div>
        </div>
        
        {!hideBalances && hasData && viewMode === "composition" && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Hoy</span>
            <span className={`text-sm font-bold ${totals.totalPnl24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPnl(totals.totalPnl24h)}
            </span>
            <span className={`text-[11px] font-medium opacity-80 ${totals.totalDailyPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({formatPercent(totals.totalDailyPnlPercent).replace('+', '')})
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-[350px]">
        {!hasData ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground/60 text-sm">
            Añade activos con transacciones para ver la distribución
          </div>
        ) : viewMode === "performance" ? (
          <div className="w-full h-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis 
                  type="number" 
                  tickFormatter={(val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val)} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="hsl(var(--foreground))" 
                  fontSize={13} 
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as ChartDatum
                    return (
                      <div className="rounded-xl bg-card/95 backdrop-blur-md border border-border p-4 shadow-2xl z-50 relative">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          <p className="text-sm font-bold text-foreground uppercase tracking-wider">{d.name}</p>
                        </div>
                        <div className="mt-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Rendimiento Hoy</p>
                          <div className="flex items-baseline gap-2">
                            <p className={`text-2xl font-bold tabular-nums ${d.dailyPnlAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {d.dailyPnlAmount > 0 ? '+' : ''}{hideBalances ? "****" : formatCurrency(d.dailyPnlAmount)}
                            </p>
                            <p className={`text-sm font-medium ${d.dailyPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ({d.dailyPnlPercent > 0 ? '+' : ''}{formatPercent(d.dailyPnlPercent).replace('+', '')})
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
                <Bar 
                  dataKey="dailyPnlAmount"
                  barSize={24}
                >
                  {chartData.data.map((entry, index) => (
                    <Cell 
                      key={entry.originalName || `cell-${index}`}
                      fill={entry.dailyPnlAmount >= 0 ? '#30d158' : '#ff453a'}
                      radius={4}
                      className="hover:opacity-80 transition-opacity duration-300 cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center lg:gap-12 gap-6 py-2 w-full h-full">
            <div className="relative w-[280px] aspect-square flex-shrink-0 group">
              <div className="absolute inset-0 z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.data}
                      innerRadius={95}
                      outerRadius={135}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={8}
                    >
                      {chartData.data.map((entry, index) => (
                        <Cell 
                          key={entry.originalName || `cell-${index}`}
                          fill={entry.color} 
                          onClick={() => {
                            setDrilldownCategoryName(entry.name)
                            setDrilldownOriginalName(entry.originalName)
                            setDrilldownModalOpen(true)
                          }}
                          className="hover:opacity-80 transition-opacity duration-300 cursor-pointer outline-none"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      cursor={{fill: 'transparent'}}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as ChartDatum
                        return (
                          <div className="rounded-xl bg-card/95 backdrop-blur-md border border-border p-4 shadow-2xl z-50 relative">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                              <p className="text-sm font-bold text-foreground uppercase tracking-wider">{d.name}</p>
                            </div>
                            <p className="text-2xl font-bold tabular-nums text-foreground">
                              {hideBalances ? "****" : formatCurrency(d.value)}
                            </p>
                            <p className="text-sm font-medium text-muted-foreground mt-1">
                              Representa el {formatPercent(d.percent).replace("+", "")} de tu cartera
                            </p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Center Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <p className="text-muted-foreground text-sm font-bold tracking-widest uppercase mb-1">Total</p>
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {hideBalances ? "****" : formatCurrency(totals.totalValue)}
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-y-3 w-full max-w-[280px]">
              {chartData.data.map((d) => (
                <div 
                  key={d.name} 
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
                  onClick={() => {
                    setDrilldownCategoryName(d.name)
                    setDrilldownOriginalName(d.originalName)
                    setDrilldownModalOpen(true)
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: d.color }} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{d.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className={`text-[11px] font-bold ${d.dailyPnlAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {d.dailyPnlAmount > 0 ? '+' : ''}{hideBalances ? "****" : formatCurrency(d.dailyPnlAmount)}
                        </p>
                        <p className={`text-[10px] font-medium ${d.dailyPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ({d.dailyPnlPercent > 0 ? '+' : ''}{formatPercent(d.dailyPnlPercent).replace('+', '')})
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">{hideBalances ? "****" : formatCurrency(d.value)}</p>
                    <p className="text-xs text-muted-foreground font-medium">{formatPercent(d.percent).replace("+", "")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CategoryDrilldownModal
        open={drilldownModalOpen}
        onOpenChange={setDrilldownModalOpen}
        categoryName={drilldownCategoryName}
        originalCategoryName={drilldownOriginalName}
        positions={positions}
        groupBy={groupBy}
        hideBalances={hideBalances}
      />
    </div>
  )
}
