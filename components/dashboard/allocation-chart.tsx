"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts"
import type { EnrichedPosition, Transaccion } from '@/lib/types'
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { computePortfolioTotals } from "@/lib/api/assets"
import { usePreferences } from "@/lib/stores/use-preferences"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Eye, EyeOff, PieChart as PieChartIcon, BarChart3, Wallet, Activity } from "lucide-react"
import { useTranslations } from "next-intl"
import { WithdrawCashModal } from "@/components/transactions/withdraw-cash-modal"
import { CategoryDrilldownModal } from "@/components/dashboard/category-drilldown-modal"
import { useHistory } from "@/lib/hooks/use-portfolio"
import { PortfolioHistoryChart } from "./portfolio-history-chart"
import { format, parseISO, subDays, subMonths, subYears, isAfter, startOfDay } from "date-fns"
import type { TimeRange, ChartDataPoint } from "./performance-modal"

interface AllocationChartProps {
  positions: EnrichedPosition[]
  pendingTxs?: Transaccion[]
  marketState?: string
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
  pnlPercent24h: number
  pnlAmount24h: number
}

export function AllocationChart({ positions, pendingTxs, marketState = 'CLOSED' }: AllocationChartProps) {
  const { hideBalances, zenMode, setZenMode } = usePreferences()
  const [viewMode, setViewMode] = useState<ViewMode>("composition")
  const [groupBy, setGroupBy] = useState<GroupBy>("tipo")
  const [isFlipped, setIsFlipped] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [cashAssetId, setCashAssetId] = useState<string>("")
  const [drilldownModalOpen, setDrilldownModalOpen] = useState(false)
  const [drilldownCategoryName, setDrilldownCategoryName] = useState("")
  const [drilldownOriginalName, setDrilldownOriginalName] = useState("")
  const totals = useMemo(() => computePortfolioTotals(positions), [positions])
  const t = useTranslations('Dashboard')

  const pendingCashEur = useMemo(() => {
    if (!pendingTxs) return 0
    return pendingTxs.reduce((sum, tx) => {
      if (tx.tipo_operacion !== 'Compra') return sum
      const fx = tx.activo?.moneda === 'USD' ? 1.07 : 1
      return sum + ((tx.cantidad * tx.precio_unitario) / fx)
    }, 0)
  }, [pendingTxs])

  const translateType = (type: string) => {
    const map: Record<string, string> = {
      "ETF": "type_etf",
      "Fondo Indexado": "type_index_fund",
      "Fondo Monetario": "type_money_market",
      "Acción": "type_stock",
      "Crypto": "type_crypto",
      "Metal": "type_metal",
    }
    return map[type] ? t(map[type]) : type
  }

  const chartData = useMemo(() => {
    const groups = new Map<string, { value: number; pnl24h: number; valorAyer: number }>()
    const colors = groupBy === "tipo" ? TYPE_COLORS : STRATEGY_COLORS

    for (const p of positions) {
      if (p.tipo === 'Liquidez' || p.tipo === 'Fondo Monetario') continue;
      
      const key = groupBy === "tipo" ? p.tipo : p.estrategia
      const value = p.valor_actual ?? p.coste_total
      const cp = p.change_percent_24h ?? 0
      
      const vAyer = value > 0 ? value / (1 + cp / 100) : 0
      const pnl24h = value > 0 ? value - vAyer : 0

      if (value > 0) {
        const existing = groups.get(key) ?? { value: 0, pnl24h: 0, valorAyer: 0 }
        groups.set(key, {
          value: existing.value + value,
          pnl24h: existing.pnl24h + pnl24h,
          valorAyer: existing.valorAyer + vAyer
        })
      }
    }

    const total = Array.from(groups.values()).reduce((a, b) => a + b.value, 0)
    const data: ChartDatum[] = Array.from(groups.entries())
      .filter(([name, groupData]) => groupData.value > 0)
      .map(([name, groupData]) => ({
        name: groupBy === "tipo" ? translateType(name) : name,
        originalName: name,
        value: groupData.value,
        color: colors[name] ?? "#71717a",
        percent: total > 0 ? (groupData.value / total) * 100 : 0,
        pnlPercent24h: groupData.valorAyer > 0 ? (groupData.pnl24h / groupData.valorAyer) * 100 : 0,
        pnlAmount24h: groupData.pnl24h
      }))
      .sort((a, b) => b.value - a.value)

    return { data, total }
  }, [positions, groupBy, t])

  const hasData = chartData.data.length > 0

  return (
    <div className="relative w-full h-full min-h-[420px]" style={{ perspective: "1000px" }}>
      <motion.div
        className="w-full h-full absolute inset-0"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front Face */}
        <Card 
          className="absolute inset-0 bg-card/40 border-border/40 backdrop-blur-md h-full flex flex-col pointer-events-auto overflow-visible shadow-sm hover:shadow-md transition-shadow"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span>{t('distribution')}</span>
                <span className={`ml-1 flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm border ${marketState === 'CLOSED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${marketState === 'CLOSED' ? 'bg-rose-500/80' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="text-[9px] tracking-widest uppercase">
                    {marketState === 'REGULAR' ? t("market_open") : marketState === 'PRE' ? t("market_pre") : marketState === 'POST' ? t("market_post") : t("market_closed")}
                  </span>
                </span>
                <button
                  onClick={() => setZenMode(!zenMode)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors ml-1"
                  title="Activar Modo ZEN"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsFlipped(true)}
                  className="ml-2 p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-colors"
                  title="Ver rendimiento"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                  <button
                    onClick={() => setViewMode("composition")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 flex items-center gap-1.5 ${
                      viewMode === "composition"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground/80 hover:text-foreground/80"
                    }`}
                  >
                    <PieChartIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Composición</span>
                  </button>
                  <button
                    onClick={() => setViewMode("performance")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 flex items-center gap-1.5 ${
                      viewMode === "performance"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground/80 hover:text-foreground/80"
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Rendimiento Hoy</span>
                  </button>
                </div>
                <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                  <button
                    onClick={() => setGroupBy("tipo")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
                      groupBy === "tipo"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground/80 hover:text-foreground/80"
                    }`}
                  >
                    {t('dist_type')}
                  </button>
                  <button
                    onClick={() => setGroupBy("estrategia")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
                      groupBy === "estrategia"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground/80 hover:text-foreground/80"
                    }`}
                  >
                    {t('dist_strategy')}
                  </button>
                </div>
              </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col justify-center">
        {!hasData ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground/60 text-sm">
            Añade activos con transacciones para ver la distribución
          </div>
        ) : viewMode === "performance" ? (
          <div className="w-full h-full min-h-[320px] pt-6">
            <ResponsiveContainer width="100%" height={320}>
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
                            <p className={`text-2xl font-bold tabular-nums ${d.pnlAmount24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {d.pnlAmount24h > 0 ? '+' : ''}{hideBalances ? "****" : formatCurrency(d.pnlAmount24h)}
                            </p>
                            <p className={`text-sm font-medium ${d.pnlPercent24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ({d.pnlPercent24h > 0 ? '+' : ''}{formatPercent(d.pnlPercent24h).replace('+', '')})
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
                <Bar 
                  dataKey="pnlAmount24h" 
                  barSize={24}
                >
                  {chartData.data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.pnlAmount24h >= 0 ? '#10b981' : '#f43f5e'} 
                      radius={entry.pnlAmount24h >= 0 ? [0, 4, 4, 0] as any : [4, 0, 0, 4] as any}
                      className="hover:opacity-80 transition-opacity duration-300 cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-row flex-wrap items-center justify-center lg:gap-16 gap-8 py-4 w-full">
            <div className="relative w-[280px] aspect-square flex-shrink-0 group">
              <div className="absolute inset-0 z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.data}
                      innerRadius={90}
                      outerRadius={120}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={8}
                    >
                      {chartData.data.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
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
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-500 group-hover:scale-110 z-0">
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Total</p>
                  <p className="text-2xl font-bold tabular-nums text-foreground drop-shadow-md">
                    {hideBalances ? "****" : formatCurrency(totals.totalValue > 0 ? totals.totalValue : chartData.total)}
                  </p>
                  {!hideBalances && (
                    <div className="flex flex-col items-center mt-1">
                      <p className={`text-sm font-bold ${totals.totalPnl24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totals.totalPnl24h > 0 ? '+' : ''}{formatCurrency(totals.totalPnl24h)}
                      </p>
                      <p className={`text-[10px] font-medium mt-0.5 opacity-80 ${totals.totalPnlPercent24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totals.totalPnlPercent24h > 0 ? '+' : ''}{formatPercent(totals.totalPnlPercent24h).replace('+', '')} hoy
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-4 w-full sm:w-[320px] max-w-sm">
              {chartData.data.map((d) => (
                <div 
                  key={d.name} 
                  className="flex items-center gap-4 group cursor-pointer hover:bg-muted/30 p-2 -mx-2 rounded-lg transition-colors"
                  onClick={() => {
                    setDrilldownCategoryName(d.name)
                    setDrilldownOriginalName(d.originalName)
                    setDrilldownModalOpen(true)
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: d.color }}
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-base font-medium text-foreground/90 group-hover:text-foreground transition-colors truncate leading-tight">
                      {d.name}
                    </p>
                    <div className="flex flex-col gap-0.5 mt-0.5 justify-center">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-bold ${d.pnlAmount24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span className="text-[10px] uppercase opacity-70 mr-1 font-semibold">Hoy:</span>
                          {d.pnlAmount24h > 0 ? '+' : ''}{hideBalances ? "****" : formatCurrency(d.pnlAmount24h)}
                        </p>
                        <p className={`text-[10px] font-medium opacity-80 ${d.pnlPercent24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ({d.pnlPercent24h > 0 ? '+' : ''}{formatPercent(d.pnlPercent24h).replace('+', '')})
                        </p>
                      </div>
                      {marketState === 'CLOSED' && (
                        <p className="text-[9px] font-medium opacity-50 uppercase tracking-wide">
                          MERCADO CERRADO
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center">
                    <div className="flex flex-col items-end">
                      <p className="text-base font-bold tabular-nums text-foreground">
                        {hideBalances ? "****" : formatCurrency(d.value)}
                      </p>
                      {d.originalName === 'Liquidez' && pendingCashEur > 0 && !hideBalances && (
                        <p className="text-[10px] font-medium tabular-nums text-amber-400 mt-0.5">
                          -{formatCurrency(pendingCashEur)} en uso
                        </p>
                      )}
                      <p className="text-xs font-medium tabular-nums text-muted-foreground mt-0.5">
                        {d.percent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Back Face */}
    <Card 
      className="absolute inset-0 bg-card/40 border-border/40 backdrop-blur-md h-full flex flex-col pointer-events-auto overflow-visible shadow-sm hover:shadow-md transition-shadow"
      style={{ 
        backfaceVisibility: "hidden", 
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)" 
      }}
    >
      <CardContent className="flex-1 overflow-hidden p-4 flex flex-col">
         <PerformanceBackFace 
           currentTotalValue={totals.totalValue} 
           currentPnl24h={totals.totalPnl24h} 
           currentTotalCost={totals.totalCost} 
           hideBalances={hideBalances} 
           onFlipBack={() => setIsFlipped(false)}
         />
      </CardContent>
    </Card>

    </motion.div>

    <WithdrawCashModal 
      open={withdrawModalOpen} 
      onOpenChange={setWithdrawModalOpen} 
      cashAssetId={cashAssetId} 
    />
    
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

function PerformanceBackFace({ currentTotalValue, currentPnl24h, currentTotalCost, hideBalances, onFlipBack }: { currentTotalValue: number, currentPnl24h: number, currentTotalCost: number, hideBalances: boolean, onFlipBack: () => void }) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M")
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null)
  const { data: snapshots, isLoading } = useHistory()

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
    
    let aggregatedSnaps = sorted
    if (timeRange !== "1D") {
      const byDate = new Map<string, typeof sorted[0]>()
      sorted.forEach(snap => {
        const dateStr = format(parseISO(snap.timestamp), 'yyyy-MM-dd')
        byDate.set(dateStr, snap)
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
    if (timeRange === "1D") startDate = startOfDay(now)
    if (timeRange === "1W") startDate = subDays(now, 7)
    if (timeRange === "1M") startDate = subMonths(now, 1)
    if (timeRange === "1Y") startDate = subYears(now, 1)

    const filtered = processedData.filter(d => isAfter(parseISO(d.timestamp), startDate))
    
    const oldestData = processedData[0]
    if (oldestData && isAfter(parseISO(oldestData.timestamp), startDate)) {
      const fakePoint: ChartDataPoint = {
        timestamp: startDate.toISOString(),
        value: oldestData.totalInvested || 0,
        totalInvested: oldestData.totalInvested || 0,
        pnl: 0,
        totalPnl: 0,
        isFirstPoint: true
      }
      return [fakePoint, ...filtered]
    }
    
    if (filtered.length < 2 && processedData.length >= 2) {
      return processedData.slice(-2)
    }
    
    return filtered
  }, [processedData, timeRange])

  const periodSummary = useMemo(() => {
    if (filteredData.length === 0) return { pnl: 0, pnlPercent: 0, endValue: 0 }
    
    const first = filteredData[0]
    const last = filteredData[filteredData.length - 1]
    
    const periodPnl = timeRange === 'ALL' 
      ? last.totalPnl 
      : last.totalPnl - first.totalPnl
      
    return { pnl: periodPnl }
  }, [filteredData, timeRange])

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Activity className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  const displayPoint = hoveredPoint || (filteredData.length > 0 ? filteredData[filteredData.length - 1] : null)
  
  const hoverPnl = hoveredPoint 
    ? (timeRange === 'ALL' ? hoveredPoint.totalPnl : hoveredPoint.totalPnl - (filteredData[0]?.totalPnl || 0))
    : periodSummary.pnl
    
  const startValue = timeRange === 'ALL' 
    ? (displayPoint?.totalInvested || 1)
    : (filteredData[0]?.value || 1)
    
  const hoverPercent = hoverPnl / startValue * 100

  const isLastPoint = hoveredPoint && filteredData.length > 0 && hoveredPoint.timestamp === filteredData[filteredData.length - 1].timestamp
  const displayDailyPnl = (hoveredPoint && !isLastPoint) ? hoveredPoint.pnl : currentPnl24h
  const displayDailyLabel = (hoveredPoint && !isLastPoint) ? 'Ese día:' : 'Hoy:'

  return (
    <div className="flex flex-col h-full relative group">
      {/* Header Overlay */}
      <div className="flex justify-between items-start z-10 w-full mb-4">
        
        {/* Top Left: Numbers */}
        <div className="flex flex-col flex-1">
          <p className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground leading-none">
            {hideBalances ? "****" : formatCurrency(displayPoint?.value || 0)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className={`flex items-center gap-1.5 font-semibold text-xs sm:text-sm ${hoverPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span>{hoverPnl >= 0 ? '+' : ''}{hideBalances ? "****" : formatCurrency(hoverPnl)}</span>
              <span className="flex items-center gap-0.5 opacity-90">
                {hoverPnl >= 0 ? '▲' : '▼'} {Math.abs(hoverPercent).toFixed(2)}%
              </span>
            </div>
            
            {timeRange !== '1D' && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold ${displayDailyPnl >= 0 ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400'}`}>
                <span className="opacity-70">{displayDailyLabel}</span>
                <span>{displayDailyPnl >= 0 ? '+' : ''}{hideBalances ? "****" : formatCurrency(displayDailyPnl)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Top Right: Filters & Flip back */}
        <div className="flex items-center gap-2">
          <div className="flex bg-card/60 backdrop-blur-md p-1 rounded-lg border border-border/50 shadow-sm hidden sm:flex">
            {(["1D", "1W", "1M", "1Y", "ALL"] as TimeRange[]).map((tr) => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-all ${
                  timeRange === tr 
                    ? "bg-foreground/10 text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {tr === '1W' ? '1S' : tr === 'ALL' ? 'TODO' : tr}
              </button>
            ))}
          </div>
          <button onClick={onFlipBack} className="p-2 bg-card/60 border border-border/50 backdrop-blur-md hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground shadow-sm" title="Volver a distribución">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex bg-card/60 backdrop-blur-md p-1 rounded-lg border border-border/50 shadow-sm sm:hidden mb-4 overflow-x-auto">
        {(["1D", "1W", "1M", "1Y", "ALL"] as TimeRange[]).map((tr) => (
          <button
            key={tr}
            onClick={() => setTimeRange(tr)}
            className={`flex-shrink-0 px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${
              timeRange === tr 
                ? "bg-foreground/10 text-foreground" 
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            {tr === '1W' ? '1S' : tr === 'ALL' ? 'TODO' : tr}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[200px] w-full -mx-4 sm:-mx-6 px-4 sm:px-6 relative">
        {/* Expand the container horizontally to hide margins but keep lines inside */}
        <div className="absolute inset-0">
          <PortfolioHistoryChart 
             chartData={filteredData} 
             onHoverChange={setHoveredPoint}
             hideTooltipContent={true}
             hideYAxis={true}
          />
        </div>
      </div>
    </div>
  )
}
