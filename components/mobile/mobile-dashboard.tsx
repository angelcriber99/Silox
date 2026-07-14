"use client"

import { useMemo, useState } from "react"
import {
  Bell, Eye, EyeOff, TrendingUp, TrendingDown,
  ChevronRight, Activity, Wallet, BarChart2,
  FileUp, ArrowUp, ArrowDown,
} from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts"
import type { MouseHandlerDataParam } from "recharts"
import { usePreferences } from "@/lib/stores/use-preferences"
import { hapticFeedback } from "@/lib/utils/haptics"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { usePortfolio, useHistory } from "@/lib/hooks/use-portfolio"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import Marquee from "react-fast-marquee"
import Link from "next/link"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
}

// ── Type color map ──────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  "ETF": "#0A84FF",
  "Fondo Indexado": "#BF5AF2",
  "Fondo Monetario": "#32ADE6",
  "Acción": "#FFD60A",
  "Crypto": "#FF9F0A",
  "Liquidez": "#98989D",
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-y border-border/10"
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
      >
        {label}
      </span>
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{
          color: "var(--muted-foreground)",
          background: "var(--muted)",
          opacity: 0.7,
        }}
      >
        {count}
      </span>
    </div>
  )
}

// ── Main dashboard ──────────────────────────────────────────────────────────
export function MobileDashboard({
  positions,
  totals,
  isLoading,
  marketState = "CLOSED",
}: MobileDashboardProps) {
  const { hideBalances, setHideBalances } = usePreferences()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>("All")
  const [chartRange, setChartRange] = useState<"1W" | "1M" | "3M" | "YTD" | "1Y" | "MAX">("1M")
  const [scrubData, setScrubData] = useState<{ i: number; v: number; pnl: number } | null>(null)
  const t = useTranslations("Dashboard")

  const { data: snapshots } = useHistory()

  const isPositive = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0
  const areaColorHex = isPositive ? "#30D158" : "#FF453A"

  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  const getMarketLabel = () => {
    switch (marketState) {
      case "REGULAR": return t("market_open")
      case "PRE":     return t("market_pre")
      case "POST":    return t("market_post")
      default:        return t("market_closed")
    }
  }

  // Portfolio chart data (Filtered by range)
  const portfolioSparkline = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    const dailySnapshots = new Map<string, typeof snapshots[0]>()
    sorted.forEach(s => {
      const day = new Date(s.timestamp).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })
      dailySnapshots.set(day, s)
    })
    
    let filtered = Array.from(dailySnapshots.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    if (filtered.length < 2) return []

    const now = new Date()
    const cutoff = new Date()
    switch (chartRange) {
      case "1W":
        cutoff.setDate(now.getDate() - 7)
        break
      case "1M":
        cutoff.setMonth(now.getMonth() - 1)
        break
      case "3M":
        cutoff.setMonth(now.getMonth() - 3)
        break
      case "YTD":
        cutoff.setFullYear(now.getFullYear(), 0, 1)
        break
      case "1Y":
        cutoff.setFullYear(now.getFullYear() - 1)
        break
      case "MAX":
        cutoff.setFullYear(2000) // All time
        break
    }

    filtered = filtered.filter(s => new Date(s.timestamp) >= cutoff)
    
    // Fallback if no data in range
    if (filtered.length < 2) {
      filtered = Array.from(dailySnapshots.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-2) // Need at least 2 points
    }

    const start = filtered[0].total_value
    return filtered.map((s, i) => ({
      i,
      v: s.total_value,
      pnl: s.total_value - start,
    }))
  }, [snapshots, chartRange])

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

  // Group by type
  const grouped = useMemo(() => {
    if (filterType !== "All") return null
    const map = new Map<string, EnrichedPosition[]>()
    const typeOrder = ["Fondo Indexado", "ETF", "Fondo Monetario", "Acción", "Crypto", "Liquidez"]
    for (const t of typeOrder) {
      const items = sortedPositions.filter(p => p.tipo === t)
      if (items.length > 0) map.set(t, items)
    }
    for (const p of sortedPositions) {
      if (!typeOrder.includes(p.tipo)) {
        const existing = map.get(p.tipo) || []
        map.set(p.tipo, [...existing, p])
      }
    }
    return map
  }, [sortedPositions, filterType])

  const totalPortfolioValue = totals.totalValue

  const bestPerformer = useMemo(() => {
    const c = positions.filter(p => typeof p.change_percent_24h === "number" && p.unidades > 0)
    if (!c.length) return null
    return c.reduce((a, b) => (a.change_percent_24h! > b.change_percent_24h! ? a : b))
  }, [positions])

  const worstPerformer = useMemo(() => {
    const c = positions.filter(p => typeof p.change_percent_24h === "number" && p.unidades > 0 && p.change_percent_24h! < 0)
    if (!c.length) return null
    return c.reduce((a, b) => (a.change_percent_24h! < b.change_percent_24h! ? a : b))
  }, [positions])

  // Movers calculation for real-time impact
  const movers = useMemo(() => {
    return [...positions]
      .filter(p => p.change_amount_24h && Math.abs(p.change_amount_24h) > 0.01)
      .sort((a, b) => (b.change_amount_24h || 0) - (a.change_amount_24h || 0))
  }, [positions])

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-4 pt-6 pb-32 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 w-24 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-full animate-pulse" style={{ background: "var(--muted)" }} />
            <div className="h-9 w-9 rounded-full animate-pulse" style={{ background: "var(--muted)" }} />
          </div>
        </div>
        <div className="h-14 w-56 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />
        <div className="h-5 w-36 rounded-lg animate-pulse" style={{ background: "var(--muted)", opacity: 0.6 }} />
        <div className="h-28 w-full rounded-2xl animate-pulse" style={{ background: "var(--muted)", opacity: 0.4 }} />
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 w-28 rounded-2xl animate-pulse flex-shrink-0" style={{ background: "var(--muted)", opacity: 0.4 }} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[70px] w-full rounded-2xl animate-pulse" style={{ background: "var(--muted)", opacity: 0.3 }} />
        ))}
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--background)" }}>

      {/* ─── Sticky header ────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderBottom: "0.5px solid rgba(255,255,255,0.10)",
        }}
      >
        {/* Gradient accent top-right corner */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isPositive
              ? "radial-gradient(ellipse 80% 60% at 90% 0%, rgba(48,209,88,0.08) 0%, transparent 60%)"
              : "radial-gradient(ellipse 80% 60% at 90% 0%, rgba(255,69,58,0.08) 0%, transparent 60%)",
          }}
        />

        <div
          className="px-5 pb-4 relative"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
        >
          {/* Top row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
              >
                Patrimonio
              </span>
              {/* Market status */}
              <div
                className="flex items-center gap-1.5 mt-0.5"
                style={{ color: isMarketOpen ? "#30D158" : "rgba(255,255,255,0.40)" }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? "animate-pulse" : ""}`}
                  style={{ background: "currentcolor" }}
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                  {getMarketLabel()}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <RevolutSync>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  <FileUp className="w-4 h-4" />
                </div>
              </RevolutSync>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { hapticFeedback.light(); setAlertsOpen(true) }}
                className="h-9 w-9 rounded-full flex items-center justify-center transition-colors"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--muted-foreground)",
                }}
                aria-label="Alertas de precio"
              >
                <Bell className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  hapticFeedback.light()
                  setHideBalances(!hideBalances)
                }}
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all border ${
                  hideBalances 
                    ? "bg-primary/15 border-primary/30 text-primary" 
                    : "bg-card border-border text-muted-foreground"
                }`}
                aria-label={hideBalances ? "Mostrar balances" : "Ocultar balances"}
              >
                {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </motion.button>
            </div>
          </div>

          {/* Main KPI — portfolio value (Scrubbable + double-tap to toggle incognito) */}
          <motion.div
            className="mb-1 cursor-pointer select-none"
            onDoubleClick={() => {
              hapticFeedback.medium()
              setHideBalances(!hideBalances)
            }}
            whileTap={{ scale: 0.98 }}
          >
            <h1
              className="font-extrabold leading-none transition-all duration-200"
              style={{
                fontSize: "clamp(48px, 13vw, 62px)",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                color: "#FFFFFF",
              }}
            >
              <AnimatedNumber value={scrubData ? scrubData.v : totals.totalValue} format="currency" hide={hideBalances} />
            </h1>
          </motion.div>

          {/* PnL badges */}
          {totals.totalCost > 0 && (
            <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
              {scrubData ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                  style={{
                    background: scrubData.pnl >= 0 ? "rgba(48,209,88,0.15)" : "rgba(255,69,58,0.15)",
                    color: scrubData.pnl >= 0 ? "#30D158" : "#FF453A",
                  }}
                >
                  {scrubData.pnl >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  <span className="text-[14px] font-bold tabular-nums">
                    {hideBalances ? "••••" : formatPnl(scrubData.pnl)}
                  </span>
                  <span className="text-[12px] font-semibold opacity-80">vs {chartRange}</span>
                </motion.div>
              ) : (
                <>
                  {/* Total PnL */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl"
                    style={{
                      background: isPositive ? "rgba(48,209,88,0.15)" : "rgba(255,69,58,0.15)",
                      color: isPositive ? "#30D158" : "#FF453A",
                    }}
                  >
                    {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    <span className="text-[14px] font-bold tabular-nums">
                      {hideBalances ? "••••" : formatPnl(totals.totalPnl)}
                    </span>
                    <span className="text-[12px] font-semibold opacity-80">
                      ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)})
                    </span>
                  </motion.div>

                  {/* 24h badge */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1 px-2 py-1 rounded-xl"
                    style={{
                      background: daily24Positive ? "rgba(48,209,88,0.10)" : "rgba(255,69,58,0.10)",
                      border: `1px solid ${daily24Positive ? "rgba(48,209,88,0.20)" : "rgba(255,69,58,0.20)"}`,
                      color: daily24Positive ? "#30D158" : "#FF453A",
                    }}
                  >
                    <span className="text-[11px] font-semibold opacity-70">Hoy</span>
                    <span className="text-[13px] font-bold tabular-nums">
                      {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
                    </span>
                  </motion.div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Sparkline chart ─────────────────────────────────────────────── */}
      {portfolioSparkline.length > 1 && (
        <div className="h-[120px] w-full relative -mt-4 mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={portfolioSparkline} 
              margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
              onMouseMove={(event: MouseHandlerDataParam) => {
                const index = Number(event.activeTooltipIndex)
                if (event.isTooltipActive && Number.isInteger(index)) {
                  const newScrub = portfolioSparkline[index]
                  if (!newScrub) return
                  setScrubData(prev => {
                    if (prev?.i !== newScrub.i) hapticFeedback.light();
                    return newScrub;
                  });
                }
              }}
              onMouseLeave={() => setScrubData(null)}
              onTouchEnd={() => setScrubData(null)}
            >
              <defs>
                <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColorHex} stopOpacity={0.5} />
                  <stop offset="60%" stopColor={areaColorHex} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={areaColorHex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin - 300", "dataMax + 300"]} />
              <Tooltip
                content={() => null} // We use the hero section to show data instead
                cursor={{ stroke: areaColorHex, strokeWidth: 1.5, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColorHex}
                strokeWidth={3}
                fill="url(#mobileGrad)"
                isAnimationActive
                animationDuration={700}
                activeDot={{ r: 5, fill: areaColorHex, stroke: "var(--background)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Chart Range Selector ────────────────────────────────────── */}
      <div className="px-4 pb-4 flex justify-between gap-1">
        {(["1W", "1M", "3M", "YTD", "1Y", "MAX"] as const).map(range => (
          <button
            key={range}
            onClick={() => { hapticFeedback.light(); setChartRange(range); }}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              chartRange === range
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground/60 hover:bg-muted/50"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* ─── Bento Grid Metrics ────────────────────────────────────────────── */}
      <div className="px-4 py-2 mb-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Box 1: Invested */}
          <div
            className="flex flex-col justify-between p-4 rounded-[24px] relative overflow-hidden bg-card border border-border/50 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-1.5 rounded-xl bg-primary/10 text-primary"
              >
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
                Invertido
              </p>
              <p className="text-[16px] font-extrabold tabular-nums mt-0.5" style={{ color: "var(--foreground)" }}>
                {hideBalances ? "••••" : formatCurrency(totals.totalCost)}
              </p>
            </div>
          </div>

          {/* Box 2: Total PnL (Dynamic Color) */}
          <div
            className="flex flex-col justify-between p-4 rounded-[24px] relative overflow-hidden"
            style={{
              background: isPositive ? "rgba(48,209,88,0.10)" : "rgba(255,69,58,0.10)",
              border: `1px solid ${isPositive ? "rgba(48,209,88,0.20)" : "rgba(255,69,58,0.20)"}`,
              boxShadow: isPositive ? "0 8px 24px -8px rgba(48,209,88,0.20)" : "0 8px 24px -8px rgba(255,69,58,0.20)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-1.5 rounded-xl"
                style={{
                  background: isPositive ? "rgba(48,209,88,0.15)" : "rgba(255,69,58,0.15)",
                  color: isPositive ? "#30D158" : "#FF453A",
                }}
              >
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isPositive ? "#30D158" : "#FF453A", opacity: 0.8 }}>
                Ganancia
              </p>
              <p className="text-[16px] font-extrabold tabular-nums mt-0.5" style={{ color: isPositive ? "#30D158" : "#FF453A" }}>
                {hideBalances ? "••••" : formatPnl(totals.totalPnl)}
              </p>
            </div>
          </div>
          
          {/* Box 3: 24h */}
          <div className="col-span-2">
            <div
              className="flex items-center justify-between p-3 rounded-2xl"
              style={{
                background: daily24Positive ? "rgba(48,209,88,0.08)" : "rgba(255,69,58,0.08)",
                border: `1px solid ${daily24Positive ? "rgba(48,209,88,0.18)" : "rgba(255,69,58,0.18)"}`,
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.40)" }}>Hoy</p>
                <p className="text-[14px] font-bold tabular-nums mt-0.5" style={{ color: daily24Positive ? "#30D158" : "#FF453A" }}>
                  {hideBalances ? "•••" : `${daily24Positive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-bold tabular-nums" style={{ color: daily24Positive ? "#30D158" : "#FF453A", opacity: 0.9 }}>
                  {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Live Market Movers (Top Gainers/Losers) ────────────────────── */}
      {movers.length > 0 && (
        <div
          className="py-4 mt-2 mb-4"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center px-4 mb-3 gap-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#30D158" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#30D158" }} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.40)" }}>
              Impacto Hoy en Tiempo Real
            </p>
          </div>
          
          <div className="w-full relative">
            <div className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory px-4 pb-2 pt-1 gap-3 scroll-smooth">
              {movers.map(p => {
                const isGain = (p.change_amount_24h || 0) >= 0;
                return (
                  <Link key={p.activo_id} href={`/activo/${p.activo_id}`} className="snap-center shrink-0">
                    <motion.div 
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-[14px] transition-colors border shadow-sm"
                      style={{
                        background: isGain ? "rgba(48,209,88,0.08)" : "rgba(255,69,58,0.08)",
                        borderColor: isGain ? "rgba(48,209,88,0.20)" : "rgba(255,69,58,0.20)",
                      }}
                    >
                      <span className="text-[12px] font-extrabold" style={{ color: "#FFFFFF" }}>
                        {p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario" 
                          ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                          : p.ticker.split(".")[0]}
                      </span>
                      <span 
                        className="text-[12px] font-bold tabular-nums flex items-center"
                        style={{ color: isGain ? "#30D158" : "#FF453A" }}
                      >
                        {isGain ? "+" : ""}{hideBalances ? "•••" : formatCurrency(p.change_amount_24h || 0)}
                      </span>
                    </motion.div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Asset filter pills ──────────────────────────────────────────── */}
      {assetTypes.length > 2 && (
        <div
          className="sticky z-10 px-4 py-2"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 80px)",
            background: "rgba(0,0,0,0.80)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {assetTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className="whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all relative flex items-center justify-center"
                style={{
                  color: filterType === type ? "#000000" : "rgba(255,255,255,0.55)",
                  background: filterType === type ? "#30D158" : "rgba(255,255,255,0.08)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {type === "All"
                  ? t("filter_all")
                  : type === "Fondo Indexado" ? t("type_index_fund")
                  : type === "Fondo Monetario" ? t("type_money_market")
                  : type === "Acción" ? t("type_stock")
                  : type === "Crypto" ? t("type_crypto")
                  : type === "ETF" ? t("type_etf")
                  : type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Asset list ──────────────────────────────────────────────────── */}
      <div className="pb-32">
        {/* Count */}
        <div className="px-4 pt-3 pb-2">
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)", opacity: 0.4 }}
          >
            {sortedPositions.length} posiciones
          </span>
        </div>

        {sortedPositions.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16 px-8">
            <div
              className="h-16 w-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "oklch(0.68 0.17 192 / 0.08)",
                border: "1px solid oklch(0.68 0.17 192 / 0.15)",
              }}
            >
              <Wallet className="w-8 h-8" style={{ color: "var(--primary)", opacity: 0.6 }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--muted-foreground)", opacity: 0.8 }}>
              Sin posiciones abiertas
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>
              Pulsa el botón + para añadir tu primera posición
            </p>
          </div>
        ) : grouped ? (
          /* Grouped by type */
          <div>
            {Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type} className="mb-2">
                <SectionHeader
                  label={
                    type === "Fondo Indexado" ? t("type_index_fund")
                    : type === "Fondo Monetario" ? t("type_money_market")
                    : type === "Acción" ? t("type_stock")
                    : type === "Crypto" ? t("type_crypto")
                    : type === "ETF" ? t("type_etf")
                    : type
                  }
                  count={items.length}
                />
                <div>
                  {items.map((p, i) => (
                    <motion.div
                      key={p.activo_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                    >
                      <MobileAssetCard
                        position={p}
                        totalPortfolioValue={totalPortfolioValue}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat filtered list */
          <div>
            {sortedPositions.map((p, i) => (
              <motion.div
                key={p.activo_id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
              >
                <MobileAssetCard position={p} totalPortfolioValue={totalPortfolioValue} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      <PriceAlerts open={alertsOpen} onOpenChange={setAlertsOpen} />
    </div>
  )
}
