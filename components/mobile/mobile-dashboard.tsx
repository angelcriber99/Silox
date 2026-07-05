"use client"

import { useMemo, useState, useRef } from "react"
import {
  Bell, Eye, EyeOff, TrendingUp, TrendingDown,
  ChevronRight, ArrowUpRight, Activity, Wallet, BarChart2,
  FileUp
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
    <div className="flex-shrink-0 flex flex-col justify-center min-w-[90px] px-2 py-1">
      <span className="text-[10px] font-semibold text-muted-foreground/40 mb-1 uppercase tracking-wider">{label}</span>
      <span className={`text-[15px] font-bold font-tabular tracking-tight ${valueColor || "text-foreground"}`}>
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
  const [filterType, setFilterType] = useState<string>("All")
  const t = useTranslations("Dashboard")

  const { data: snapshots } = useHistory()

  const isPositive      = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0
  const areaColor       = isPositive ? "#10b981" : "#f43f5e"

  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  const getMarketLabel = () => {
    switch (marketState) {
      case "REGULAR": return t("market_open")
      case "PRE":     return t("market_pre")
      case "POST":    return t("market_post")
      default:        return t("market_closed")
    }
  }

  // Portfolio sparkline
  const portfolioSparkline = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []
    
    const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    
    // Group by day and take the last snapshot of each day
    const dailySnapshots = new Map<string, typeof snapshots[0]>()
    sorted.forEach(s => {
      const day = new Date(s.timestamp).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })
      dailySnapshots.set(day, s)
    })
    
    // Convert back to array, sort by time, and get last 7
    const last7Days = Array.from(dailySnapshots.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-7)
      
    if (last7Days.length < 2) return []
    const start = last7Days[0].total_value
    return last7Days.map((s, i) => ({
      i,
      v: s.total_value,
      pnl: s.total_value - start
    }))
  }, [snapshots])

  // Sorted + filtered positions
  const sortedPositions = useMemo(() => {
    let result = [...positions].filter(p => p.unidades > 0)
    if (filterType !== "All") result = result.filter(p => p.tipo === filterType)
    return result.sort((a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0))
  }, [positions, filterType])

  const assetTypes = useMemo(() => {
    const types = new Set(positions.filter(p => p.unidades > 0).map(p => p.tipo))
    return ["All", ...Array.from(types)]
  }, [positions])

  // Group by type for sections
  const grouped = useMemo(() => {
    if (filterType !== "All") return null
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
  }, [sortedPositions, filterType])

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
      <div className="sticky top-0 z-20 bg-background/60 dark:bg-zinc-950/60 backdrop-blur-[40px] backdrop-saturate-[200%] border-b border-black/5 dark:border-white/5">
        <div className="px-5 pt-[max(env(safe-area-inset-top),20px)] pb-4">

          {/* Top row: actions only (iOS style) */}
          <div className="flex items-center justify-end mb-4">

            <div className="flex items-center gap-2">
              <RevolutSync>
                <div className="h-9 w-9 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors">
                  <FileUp className="w-4 h-4" />
                </div>
              </RevolutSync>
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
            <h1 className="text-[56px] font-extrabold tracking-tighter text-foreground leading-[1] mb-3">
              <AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} />
            </h1>

            {totals.totalCost > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className={`flex items-baseline gap-2 ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                  <span className="text-[18px] font-bold font-tabular tracking-tight">
                    {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
                  </span>
                  <span className="text-[14px] font-semibold opacity-80">
                    ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)})
                  </span>
                </div>
                <div className={`flex items-baseline gap-2 ${daily24Positive ? "text-emerald-500" : "text-rose-500"}`}>
                  <span className="text-muted-foreground/40 text-[13px] font-medium">Hoy</span>
                  <span className="text-[14px] font-bold font-tabular tracking-tight">{hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Sparkline removed for minimalist look ─────────────────────── */}



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
        <div className="px-4 pb-3 sticky top-[115px] z-10 bg-background/60 dark:bg-zinc-950/60 backdrop-blur-[40px] backdrop-saturate-[200%] border-b border-black/5 dark:border-white/5 mb-3 pt-2">

          {assetTypes.length > 2 && (
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {assetTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] transition-all relative z-10 ${
                    filterType === type
                      ? "text-background dark:text-zinc-950 font-bold"
                      : "text-muted-foreground/60 font-medium"
                  }`}
                >
                  {type === "All" ? t("filter_all") : type === "Fondo Indexado" ? t("type_index_fund") : type === "Fondo Monetario" ? t("type_money_market") : type === "Acción" ? t("type_stock") : type === "Crypto" ? t("type_crypto") : type === "ETF" ? t("type_etf") : type}
                  {filterType === type && (
                    <motion.div
                      layoutId="activeFilter"
                      className="absolute inset-0 bg-foreground rounded-full -z-10 shadow-sm"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
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
                <SectionHeader label={type === "Fondo Indexado" ? t("type_index_fund") : type === "Fondo Monetario" ? t("type_money_market") : type === "Acción" ? t("type_stock") : type === "Crypto" ? t("type_crypto") : type === "ETF" ? t("type_etf") : type} count={items.length} total={totalPortfolioValue} />
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
