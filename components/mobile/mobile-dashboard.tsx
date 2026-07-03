"use client"

import { useMemo, useState, useRef } from "react"
import {
  Bell, Eye, EyeOff, RefreshCw, TrendingUp, TrendingDown,
  ChevronRight, ArrowUpRight, Activity, Wallet, BarChart2
} from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts"
import { usePreferences } from "@/lib/stores/use-preferences"
import { playSound } from "@/lib/utils/sounds"
import { hapticFeedback } from "@/lib/utils/haptics"
import { PerformanceModal } from "@/components/dashboard/performance-modal"
import { usePortfolio, useHistory } from "@/lib/hooks/use-portfolio"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { motion, useAnimation } from "framer-motion"
import { useTranslations } from "next-intl"
import { RevolutSync } from "@/components/transactions/revolut-sync"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
}

// ── Metric pill component ────────────────────────────────────────────────
function MetricPill({
  label,
  value,
  valueColor,
  hide,
}: {
  label: string
  value: React.ReactNode
  valueColor?: string
  hide?: boolean
}) {
  return (
    <div className="flex-shrink-0 flex flex-col justify-center min-w-[90px] pr-4">
      <span className="text-[10px] font-medium text-muted-foreground/50 mb-0.5">{label}</span>
      <span className={`text-[13px] font-semibold font-tabular ${valueColor || "text-foreground"}`}>
        {hide ? "••••" : value}
      </span>
    </div>
  )
}

// ── Asset type section header ────────────────────────────────────────────
function SectionHeader({ label, count, total }: { label: string; count: number; total: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/20">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</span>
      <span className="text-[10px] font-medium text-muted-foreground/40">{count} activos</span>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────
export function MobileDashboard({
  positions,
  totals,
  isLoading,
  marketState = "CLOSED",
}: MobileDashboardProps) {
  const { soundEffects, hideBalances, setHideBalances, compactView } = usePreferences()
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("All")
  const t = useTranslations("Dashboard")

  const { data: snapshots } = useHistory()

  const isPositive      = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0
  const areaColor       = isPositive ? "#10b981" : "#f43f5e"
  const refreshControls = useAnimation()

  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  const getMarketLabel = () => {
    switch (marketState) {
      case "REGULAR": return "Abierto"
      case "PRE":     return "Pre-market"
      case "POST":    return "After-hours"
      default:        return "Cerrado"
    }
  }

  const handleRefresh = async () => {
    if (isRefreshing) return
    hapticFeedback.medium()
    setIsRefreshing(true)
    refreshControls.start({ rotate: 360, transition: { repeat: Infinity, duration: 1, ease: "linear" } })
    await new Promise(r => setTimeout(r, 1500))
    setIsRefreshing(false)
    refreshControls.stop()
    refreshControls.set({ rotate: 0 })
    hapticFeedback.success()
  }

  // Portfolio sparkline
  const portfolioSparkline = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []
    const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const last7 = sorted.slice(-7)
    if (last7.length < 2) return []
    const start = last7[0].total_value
    return last7.map((s, i) => ({
      i,
      v: s.total_value,
      pnl: s.total_value - start
    }))
  }, [snapshots])

  // Sorted + filtered positions
  const sortedPositions = useMemo(() => {
    let result = [...positions].filter(p => p.unidades > 0)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.ticker.toLowerCase().includes(q) || (p.nombre && p.nombre.toLowerCase().includes(q))
      )
    }
    if (filterType !== "All") result = result.filter(p => p.tipo === filterType)
    return result.sort((a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0))
  }, [positions, searchQuery, filterType])

  const assetTypes = useMemo(() => {
    const types = new Set(positions.filter(p => p.unidades > 0).map(p => p.tipo))
    return ["All", ...Array.from(types)]
  }, [positions])

  // Group by type for sections
  const grouped = useMemo(() => {
    if (filterType !== "All" || searchQuery) return null
    const map = new Map<string, EnrichedPosition[]>()
    const typeOrder = ["Fondo Indexado", "ETF", "Fondo Monetario", "Acción", "Crypto", "Liquidez"]
    for (const t of typeOrder) {
      const items = sortedPositions.filter(p => p.tipo === t)
      if (items.length > 0) map.set(t, items)
    }
    // Any types not in order
    for (const p of sortedPositions) {
      if (!typeOrder.includes(p.tipo)) {
        const existing = map.get(p.tipo) || []
        map.set(p.tipo, [...existing, p])
      }
    }
    return map
  }, [sortedPositions, filterType, searchQuery])

  const totalPortfolioValue = totals.totalValue

  // Best/worst performers
  const bestPerformer = useMemo(() => {
    const candidates = positions.filter(p => typeof p.change_percent_24h === "number" && p.unidades > 0)
    if (!candidates.length) return null
    return candidates.reduce((a, b) => (a.change_percent_24h! > b.change_percent_24h! ? a : b))
  }, [positions])

  const worstPerformer = useMemo(() => {
    const candidates = positions.filter(p => typeof p.change_percent_24h === "number" && p.unidades > 0 && p.change_percent_24h! < 0)
    if (!candidates.length) return null
    return candidates.reduce((a, b) => (a.change_percent_24h! < b.change_percent_24h! ? a : b))
  }, [positions])

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-4 pt-6 pb-28 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 w-20 bg-muted/50 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-muted/50 rounded-xl animate-pulse" />
            <div className="h-8 w-8 bg-muted/50 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="h-12 w-48 bg-muted/50 rounded-xl animate-pulse mt-4" />
        <div className="h-5 w-32 bg-muted/40 rounded-lg animate-pulse" />
        <div className="h-24 w-full bg-muted/30 rounded-2xl animate-pulse mt-2" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map(i => <div key={i} className="h-16 w-28 bg-muted/30 rounded-2xl animate-pulse flex-shrink-0" />)}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[72px] w-full bg-muted/30 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className="pb-28 flex flex-col min-h-screen bg-background">

      {/* ─── Sticky Header ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-2xl border-b border-border/30 shadow-sm">
        <div className="px-5 pt-safe-top pt-5 pb-4">

          {/* Top row: actions only (iOS style) */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
                Patrimonio
              </span>
              <div className={`flex items-center gap-1.5 mt-0.5 ${isMarketOpen ? "text-emerald-500" : "text-muted-foreground/60"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{getMarketLabel()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleRefresh}
                className="h-9 w-9 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <motion.div animate={refreshControls}>
                  <RefreshCw className="w-4 h-4" />
                </motion.div>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { hapticFeedback.light(); setAlertsOpen(true) }}
                className="h-9 w-9 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <Bell className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (soundEffects) playSound("click")
                  hapticFeedback.light()
                  setHideBalances(!hideBalances)
                }}
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                  hideBalances ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </motion.button>
            </div>
          </div>

          {/* Main KPI block (iOS Large Title style) */}
          <div className="mt-2">
            <h1 className="text-[52px] font-extrabold tracking-tighter text-foreground leading-[1.1] mb-2">
              <AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} />
            </h1>

            {totals.totalCost > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Minimalist PnL display */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                  <span className="text-[15px] font-bold font-tabular">
                    {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
                  </span>
                  <span className="text-[13px] font-semibold opacity-90">
                    ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)})
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 ml-2 ${daily24Positive ? "text-emerald-500" : "text-rose-500"}`}>
                  <span className="text-muted-foreground/60 text-[12px] font-medium">Hoy</span>
                  <span className="text-[14px] font-bold font-tabular">{hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Sparkline ────────────────────────────────────────────────── */}
      {portfolioSparkline.length > 1 && (
        <div className="h-28 w-full relative -mt-1">
          {/* Gradient overlay top for seamless blend */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background/40 to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background/20 to-transparent z-10 pointer-events-none" />
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioSparkline} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={areaColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin - 200", "dataMax + 200"]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  const isUp = d.pnl >= 0
                  return (
                    <div className="bg-card/95 backdrop-blur-xl border border-border/40 rounded-xl px-3 py-2 shadow-2xl">
                      <p className="text-[13px] font-bold font-tabular text-foreground">{formatCurrency(d.v)}</p>
                      <p className={`text-[11px] font-medium font-tabular ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                        {isUp ? "+" : ""}{formatCurrency(d.pnl)} vs inicio semana
                      </p>
                    </div>
                  )
                }}
                cursor={{ stroke: areaColor, strokeWidth: 1, strokeDasharray: "3 3" }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColor}
                strokeWidth={2}
                fill="url(#mobileGrad)"
                isAnimationActive={true}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Main Actions ──────────────────────────────────────────────── */}
      <div className="px-4 mt-4 mb-4">
        <RevolutSync className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-foreground text-background font-bold text-[15px] shadow-lg shadow-foreground/20 active:scale-[0.98] transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          Sincronizar Movimientos
        </RevolutSync>
      </div>

      {/* ─── Scrollable metrics pills ──────────────────────────────────── */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <MetricPill
            label="Invertido"
            value={formatCurrency(totals.totalCost)}
            hide={hideBalances}
          />
          <MetricPill
            label="Ganancia Total"
            value={`${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
            valueColor={isPositive ? "text-emerald-400" : "text-rose-400"}
            hide={hideBalances}
          />
          <MetricPill
            label="Hoy"
            value={`${daily24Positive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}
            valueColor={daily24Positive ? "text-emerald-400" : "text-rose-400"}
            hide={hideBalances}
          />
          {bestPerformer && (
            <MetricPill
              label={`↑ ${bestPerformer.ticker.split(".")[0]}`}
              value={formatPercent(bestPerformer.change_percent_24h ?? 0)}
              valueColor="text-emerald-400"
              hide={hideBalances}
            />
          )}
          {worstPerformer && (
            <MetricPill
              label={`↓ ${worstPerformer.ticker.split(".")[0]}`}
              value={formatPercent(worstPerformer.change_percent_24h ?? 0)}
              valueColor="text-rose-400"
              hide={hideBalances}
            />
          )}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { hapticFeedback.light(); setPerformanceOpen(true) }}
            className="flex-shrink-0 flex flex-col gap-0.5 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 min-w-[110px] hover:bg-primary/15 transition-colors"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">Análisis</span>
            <div className="flex items-center gap-1 text-primary">
              <BarChart2 className="w-3 h-3" />
              <span className="text-[13px] font-bold">Ver</span>
            </div>
          </motion.button>
        </div>
      </div>

      {/* ─── Asset list ───────────────────────────────────────────────── */}
      <div>
        {/* Sticky search + filters */}
        <div className="px-4 pb-3 sticky top-[136px] z-10 bg-background/90 backdrop-blur-xl">
          <div className="flex items-center gap-2 bg-muted/30 border border-border/40 rounded-2xl px-3 py-2.5 mb-3">
            <svg className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar activo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none"
            />
          </div>

          {assetTypes.length > 2 && (
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {assetTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`whitespace-nowrap px-1 py-2 text-[14px] transition-colors relative ${
                    filterType === type
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground/50 font-medium"
                  }`}
                >
                  {type === "All" ? "Todos" : type === "Fondo Indexado" ? "Fondos" : type === "Fondo Monetario" ? "Monetario" : type}
                  {filterType === type && (
                    <motion.div
                      layoutId="activeFilter"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Positions count */}
        <div className="px-4 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
            {sortedPositions.length} posiciones
          </span>
        </div>

        {/* List */}
        {sortedPositions.length === 0 ? (
          <div className="text-center py-16 px-8">
            <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground/60">Sin posiciones abiertas</p>
            <p className="text-xs text-muted-foreground/40 mt-1">Añade tu primera transacción con el botón +</p>
          </div>
        ) : grouped ? (
          // Grouped by type
          <div className="divide-y divide-border/20">
            {Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type} className="mb-4">
                <SectionHeader label={type === "Fondo Indexado" ? "Fondos Indexados" : type} count={items.length} total={totalPortfolioValue} />
                <div className="divide-y divide-white/5">
                  {items.map(p => (
                    <MobileAssetCard key={p.activo_id} position={p} totalPortfolioValue={totalPortfolioValue} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat list when searching/filtering
          <div className="divide-y divide-border/10">
            {sortedPositions.map(p => (
              <MobileAssetCard key={p.activo_id} position={p} totalPortfolioValue={totalPortfolioValue} />
            ))}
          </div>
        )}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────── */}
      <PerformanceModal
        open={performanceOpen}
        onOpenChange={setPerformanceOpen}
        currentPnl24h={totals.totalPnl24h}
        currentTotalValue={totals.totalValue}
        currentTotalCost={totals.totalCost}
      />
      <PriceAlerts open={alertsOpen} onOpenChange={setAlertsOpen} />
    </div>
  )
}
