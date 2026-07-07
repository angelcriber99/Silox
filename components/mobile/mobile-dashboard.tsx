"use client"

import { useMemo, useState } from "react"
import {
  Bell, Eye, EyeOff, TrendingUp, TrendingDown,
  ChevronRight, Activity, Wallet, BarChart2,
  FileUp, ArrowUp, ArrowDown,
} from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts"
import { usePreferences } from "@/lib/stores/use-preferences"
import { hapticFeedback } from "@/lib/utils/haptics"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { PerformanceModal } from "@/components/dashboard/performance-modal"
import { usePortfolio, useHistory } from "@/lib/hooks/use-portfolio"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { RevolutSync } from "@/components/transactions/revolut-sync"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
}

// ── Type color map ────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  "ETF": "oklch(0.60 0.17 270)",
  "Fondo Indexado": "oklch(0.65 0.17 310)",
  "Fondo Monetario": "oklch(0.65 0.17 192)",
  "Acción": "oklch(0.72 0.15 55)",
  "Crypto": "oklch(0.70 0.18 30)",
  "Liquidez": "oklch(0.60 0.016 230)",
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{
        borderTop: "1px solid oklch(0.68 0.17 192 / 0.08)",
        borderBottom: "1px solid oklch(0.68 0.17 192 / 0.08)",
      }}
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
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>("All")
  const [scrubData, setScrubData] = useState<{ i: number; v: number; pnl: number } | null>(null)
  const t = useTranslations("Dashboard")

  const { data: snapshots } = useHistory()

  const isPositive = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0
  const areaColor = isPositive
    ? "oklch(0.65 0.19 155)"
    : "oklch(0.62 0.20 20)"
  const areaColorHex = isPositive ? "#22c55e" : "#ef4444"

  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  const getMarketLabel = () => {
    switch (marketState) {
      case "REGULAR": return t("market_open")
      case "PRE":     return t("market_pre")
      case "POST":    return t("market_post")
      default:        return t("market_closed")
    }
  }

  // Portfolio sparkline (last 7 days)
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
    const last7Days = Array.from(dailySnapshots.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-7)
    if (last7Days.length < 2) return []
    const start = last7Days[0].total_value
    return last7Days.map((s, i) => ({
      i,
      v: s.total_value,
      pnl: s.total_value - start,
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

      {/* ─── Sticky header ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: "oklch(0.095 0.012 235 / 0.88)",
          backdropFilter: "blur(28px) saturate(200%)",
          WebkitBackdropFilter: "blur(28px) saturate(200%)",
          borderBottom: "1px solid oklch(0.68 0.17 192 / 0.10)",
        }}
      >
        {/* Subtle gradient mesh */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isPositive
              ? "radial-gradient(ellipse 100% 100% at 80% 0%, oklch(0.65 0.19 155 / 0.06) 0%, transparent 60%)"
              : "radial-gradient(ellipse 100% 100% at 80% 0%, oklch(0.62 0.20 20 / 0.05) 0%, transparent 60%)",
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
                style={{ color: isMarketOpen ? "oklch(0.65 0.19 155)" : "oklch(0.50 0.01 230)" }}
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
                className="h-9 w-9 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: hideBalances
                    ? "oklch(0.68 0.17 192 / 0.15)"
                    : "var(--card)",
                  border: hideBalances
                    ? "1px solid oklch(0.68 0.17 192 / 0.30)"
                    : "1px solid var(--border)",
                  color: hideBalances ? "var(--primary)" : "var(--muted-foreground)",
                }}
                aria-label={hideBalances ? "Mostrar balances" : "Ocultar balances"}
              >
                {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </motion.button>
            </div>
          </div>

          {/* Main KPI — portfolio value (Scrubbable) */}
          <div className="mb-1">
            <h1
              className="font-extrabold tracking-tighter leading-none font-display-number transition-all duration-200"
              style={{ fontSize: "clamp(42px, 12vw, 54px)", color: "var(--foreground)" }}
            >
              <AnimatedNumber value={scrubData ? scrubData.v : totals.totalValue} format="currency" hide={hideBalances} />
            </h1>
          </div>

          {/* PnL badges */}
          {totals.totalCost > 0 && (
            <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
              {scrubData ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                  style={{
                    background: scrubData.pnl >= 0 ? "oklch(0.65 0.19 155 / 0.12)" : "oklch(0.62 0.20 20 / 0.12)",
                    color: scrubData.pnl >= 0 ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)",
                  }}
                >
                  {scrubData.pnl >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  <span className="text-[14px] font-bold font-tabular">
                    {hideBalances ? "••••" : `${scrubData.pnl >= 0 ? "+" : ""}${formatCurrency(scrubData.pnl)}`}
                  </span>
                  <span className="text-[12px] font-semibold opacity-80">vs 7d</span>
                </motion.div>
              ) : (
                <>
                  {/* Total PnL */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                    style={{
                      background: isPositive ? "oklch(0.65 0.19 155 / 0.12)" : "oklch(0.62 0.20 20 / 0.12)",
                      color: isPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)",
                    }}
                  >
                    {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    <span className="text-[14px] font-bold font-tabular">
                      {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
                    </span>
                    <span className="text-[12px] font-semibold opacity-80">
                      ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)})
                    </span>
                  </motion.div>

                  {/* 24h badge */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg"
                    style={{
                      background: daily24Positive ? "oklch(0.65 0.19 155 / 0.08)" : "oklch(0.62 0.20 20 / 0.08)",
                      border: `1px solid ${daily24Positive ? "oklch(0.65 0.19 155 / 0.20)" : "oklch(0.62 0.20 20 / 0.20)"}`,
                    }}
                  >
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
                    >Hoy</span>
                    <span className="text-[13px] font-bold font-tabular">
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
              onMouseMove={(e: any) => {
                if (e.activePayload && e.activePayload.length > 0) {
                  const newScrub = e.activePayload[0].payload;
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

      {/* ─── Bento Grid Metrics ────────────────────────────────────────────── */}
      <div className="px-4 py-2 mb-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Box 1: Invested */}
          <div
            className="flex flex-col justify-between p-4 rounded-[24px] relative overflow-hidden"
            style={{
              background: "linear-gradient(145deg, oklch(0.975 0.004 200) 0%, oklch(0.95 0.01 200) 100%)",
              border: "1px solid oklch(0.68 0.17 192 / 0.10)",
              boxShadow: "0 8px 24px -8px oklch(0 0 0 / 0.05)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-1.5 rounded-xl"
                style={{ background: "oklch(0.68 0.17 192 / 0.08)", color: "var(--primary)" }}
              >
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
                Invertido
              </p>
              <p className="text-[16px] font-extrabold font-tabular mt-0.5" style={{ color: "var(--foreground)" }}>
                {hideBalances ? "••••" : formatCurrency(totals.totalCost)}
              </p>
            </div>
          </div>

          {/* Box 2: Total PnL (Dynamic Color) */}
          <div
            className="flex flex-col justify-between p-4 rounded-[24px] relative overflow-hidden"
            style={{
              background: isPositive ? "linear-gradient(145deg, oklch(0.65 0.19 155 / 0.12), oklch(0.65 0.19 155 / 0.05))" : "linear-gradient(145deg, oklch(0.62 0.20 20 / 0.12), oklch(0.62 0.20 20 / 0.05))",
              border: `1px solid ${isPositive ? "oklch(0.65 0.19 155 / 0.20)" : "oklch(0.62 0.20 20 / 0.20)"}`,
              boxShadow: isPositive ? "0 8px 24px -8px oklch(0.65 0.19 155 / 0.2)" : "0 8px 24px -8px oklch(0.62 0.20 20 / 0.2)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-1.5 rounded-xl"
                style={{
                  background: isPositive ? "oklch(0.65 0.19 155 / 0.15)" : "oklch(0.62 0.20 20 / 0.15)",
                  color: isPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)"
                }}
              >
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)", opacity: 0.8 }}>
                Ganancia
              </p>
              <p className="text-[16px] font-extrabold font-tabular mt-0.5" style={{ color: isPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)" }}>
                {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
              </p>
            </div>
          </div>
          
          {/* Box 3: 24h & Best Performer */}
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <div
              className="flex items-center justify-between p-3 rounded-2xl"
              style={{
                background: daily24Positive ? "oklch(0.65 0.19 155 / 0.08)" : "oklch(0.62 0.20 20 / 0.08)",
                border: `1px solid ${daily24Positive ? "oklch(0.65 0.19 155 / 0.15)" : "oklch(0.62 0.20 20 / 0.15)"}`,
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>Hoy</p>
                <p className="text-[14px] font-bold font-tabular mt-0.5" style={{ color: daily24Positive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)" }}>
                  {hideBalances ? "•••" : `${daily24Positive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-bold font-tabular" style={{ color: daily24Positive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)", opacity: 0.9 }}>
                  {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
                </p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { hapticFeedback.light(); setPerformanceOpen(true) }}
              className="flex items-center justify-between p-3 rounded-2xl"
              style={{
                background: "oklch(0.68 0.17 192 / 0.12)",
                border: "1px solid oklch(0.68 0.17 192 / 0.20)",
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--primary)", opacity: 0.8 }}>Análisis</p>
                <p className="text-[14px] font-bold mt-0.5" style={{ color: "var(--primary)" }}>Ver detalle</p>
              </div>
              <div className="p-1.5 rounded-full" style={{ background: "var(--primary)", color: "white" }}>
                <BarChart2 className="w-3.5 h-3.5" />
              </div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── Asset filter pills ──────────────────────────────────────────── */}
      {assetTypes.length > 2 && (
        <div
          className="sticky z-10 px-4 py-2"
          style={{
            top: 0,
            background: "oklch(0.095 0.012 235 / 0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {assetTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all relative"
                style={{
                  color: filterType === type ? "var(--background)" : "var(--muted-foreground)",
                  opacity: filterType === type ? 1 : 0.7,
                }}
              >
                {filterType === type && (
                  <motion.div
                    layoutId="filterPill"
                    className="absolute inset-0 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    style={{
                      background: "linear-gradient(135deg, oklch(0.68 0.17 192), oklch(0.65 0.19 155))",
                    }}
                  />
                )}
                <span className="relative z-10">
                  {type === "All"
                    ? t("filter_all")
                    : type === "Fondo Indexado" ? t("type_index_fund")
                    : type === "Fondo Monetario" ? t("type_money_market")
                    : type === "Acción" ? t("type_stock")
                    : type === "Crypto" ? t("type_crypto")
                    : type === "ETF" ? t("type_etf")
                    : type}
                </span>
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
