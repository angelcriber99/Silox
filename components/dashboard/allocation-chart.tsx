"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { computePortfolioTotals } from "@/lib/api/assets"
import { usePreferences } from "@/lib/stores/use-preferences"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Eye, EyeOff, PieChart as PieChartIcon, BarChart3, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { WithdrawCashModal } from "@/components/transactions/withdraw-cash-modal"

interface AllocationChartProps {
  positions: EnrichedPosition[]
  marketState?: string
}

const TYPE_COLORS: Record<string, string> = {
  ETF: "#3b82f6",
  "Fondo Indexado": "#8b5cf6",
  "Fondo Monetario": "#06b6d4",
  Acción: "#f59e0b",
  Crypto: "#f97316",
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

export function AllocationChart({ positions, marketState = 'CLOSED' }: AllocationChartProps) {
  const { hideBalances, zenMode, setZenMode } = usePreferences()
  const [viewMode, setViewMode] = useState<ViewMode>("composition")
  const [groupBy, setGroupBy] = useState<GroupBy>("tipo")
  const [isFlipped, setIsFlipped] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [cashAssetId, setCashAssetId] = useState<string>("")
  const totals = useMemo(() => computePortfolioTotals(positions), [positions])
  const t = useTranslations('Dashboard')

  const translateType = (type: string) => {
    const map: Record<string, string> = {
      "ETF": "type_etf",
      "Fondo Indexado": "type_index_fund",
      "Fondo Monetario": "type_money_market",
      "Acción": "type_stock",
      "Crypto": "type_crypto",
    }
    return map[type] ? t(map[type]) : type
  }

  const chartData = useMemo(() => {
    const groups = new Map<string, { value: number; pnl24h: number; valorAyer: number }>()
    const colors = groupBy === "tipo" ? TYPE_COLORS : STRATEGY_COLORS

    for (const p of positions) {
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

    if (groupBy === "tipo" && !groups.has("Liquidez")) {
      groups.set("Liquidez", { value: 0, pnl24h: 0, valorAyer: 0 })
    }

    const total = Array.from(groups.values()).reduce((a, b) => a + b.value, 0)
    const data: ChartDatum[] = Array.from(groups.entries())
      .map(([name, groupData]) => ({
        name: groupBy === "tipo" ? translateType(name) : name,
        originalName: name,
        value: groupData.value,
        color: colors[name] ?? "#71717a",
        percent: total > 0 ? (groupData.value / total) * 100 : 0,
        pnlPercent24h: groupData.valorAyer > 0 ? (groupData.pnl24h / groupData.valorAyer) * 100 : 0,
        pnlAmount24h: groupData.pnl24h
      }))
      .sort((a, b) => {
        // Siempre poner liquidez al final si su valor es 0
        if (a.originalName === "Liquidez" && a.value === 0) return 1
        if (b.originalName === "Liquidez" && b.value === 0) return -1
        return b.value - a.value
      })

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
                {zenMode && (
                  <button onClick={() => setIsFlipped(true)} className="ml-2 p-1 hover:bg-muted rounded-full transition-colors" title="Dar la vuelta">
                    <RefreshCw className="w-4 h-4 text-primary" />
                  </button>
                )}
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
                            <p className={`text-2xl font-bold font-tabular ${d.pnlAmount24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
            <div className="h-[280px] w-[280px] flex-shrink-0 relative group">
              <PieChart width={280} height={280}>
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
                        <p className="text-2xl font-bold font-tabular text-foreground">
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
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-500 group-hover:scale-110">
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Total</p>
                  <p className="text-2xl font-bold font-tabular text-foreground drop-shadow-md">
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
                <div key={d.name} className="flex items-center gap-4 group">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: d.color }}
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-base font-medium text-foreground/90 group-hover:text-foreground transition-colors truncate leading-tight">
                      {d.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 justify-start">
                      {marketState === 'CLOSED' ? (
                        <p className="text-[10px] font-medium opacity-60 uppercase tracking-wide">
                          MERCADO CERRADO
                        </p>
                      ) : (
                        <>
                          <p className={`text-xs font-bold ${d.pnlAmount24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <span className="text-[10px] uppercase opacity-70 mr-1 font-semibold">Hoy:</span>
                            {d.pnlAmount24h > 0 ? '+' : ''}{hideBalances ? "****" : formatCurrency(d.pnlAmount24h)}
                          </p>
                          <p className={`text-[10px] font-medium opacity-80 ${d.pnlPercent24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ({d.pnlPercent24h > 0 ? '+' : ''}{formatPercent(d.pnlPercent24h).replace('+', '')})
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center">
                    <div className="flex flex-col items-end">
                      <p className="text-base font-bold font-tabular text-foreground">
                        {hideBalances ? "****" : formatCurrency(d.value)}
                      </p>
                      <p className="text-xs font-medium font-tabular text-muted-foreground">
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
    {zenMode && (
      <Card 
        className="absolute inset-0 bg-card/40 border-border/40 backdrop-blur-md h-full flex flex-col pointer-events-auto overflow-visible shadow-sm hover:shadow-md transition-shadow"
        style={{ 
          backfaceVisibility: "hidden", 
          WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)" 
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Resumen de Activos
              <button onClick={() => setIsFlipped(false)} className="ml-2 p-1 hover:bg-muted rounded-full transition-colors" title="Volver a distribución">
                <RefreshCw className="w-4 h-4 text-primary" />
              </button>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pt-0">
          <div className="space-y-4 pt-2">
            {positions.map(p => (
              <div key={p.activo_id} className="flex justify-between items-center border-b border-border/50 pb-2 last:border-0">
                <div>
                  <p className="font-medium text-foreground">{p.ticker}</p>
                  <p className="text-xs text-muted-foreground">{p.nombre}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{hideBalances ? "****" : formatCurrency(p.valor_actual || 0)}</p>
                  <p className={`text-xs ${p.pnl && p.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {p.pnl && p.pnl > 0 ? "+" : ""}{formatCurrency(p.pnl || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
    </motion.div>

    <WithdrawCashModal 
      open={withdrawModalOpen} 
      onOpenChange={setWithdrawModalOpen} 
      cashAssetId={cashAssetId} 
    />
  </div>
  )
}

