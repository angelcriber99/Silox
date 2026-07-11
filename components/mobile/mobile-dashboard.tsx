"use client"

import { lazy, Suspense, useMemo, useState } from "react"
import {
  Bell, Eye, EyeOff, TrendingUp, TrendingDown,
  Wallet, FileUp, ArrowUp, ArrowDown,
} from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts"
import { usePreferences } from "@/lib/stores/use-preferences"
import { hapticFeedback } from "@/lib/utils/haptics"
import { useHistory } from "@/lib/hooks/use-portfolio"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import { useAlerts } from "@/lib/hooks/use-alerts"
import { usePriceAlertNotifications } from "@/components/dashboard/use-price-alert-notifications"
import Link from "next/link"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
}

const TYPE_ORDER = ["Fondo Indexado", "ETF", "Fondo Monetario", "Acción", "Crypto", "Liquidez"]
const MAX_STAGGERED_ROWS = 12
const PriceAlerts = lazy(() =>
  import("@/components/dashboard/price-alerts").then((mod) => ({
    default: mod.PriceAlerts,
  }))
)

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
  const [scrubData, setScrubData] = useState<{ i: number; v: number; pnl: number } | null>(null)
  const t = useTranslations("Dashboard")

  const { data: snapshots } = useHistory()
  const { alerts, removeAlert } = useAlerts()
  usePriceAlertNotifications(positions, alerts, removeAlert)

  const isPositive = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0
  const areaColorHex = isPositive ? "#10d98a" : "#ff4d6a"

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

    for (const type of TYPE_ORDER) map.set(type, [])

    for (const p of sortedPositions) {
      const items = map.get(p.tipo)
      if (items) items.push(p)
      else map.set(p.tipo, [p])
    }

    for (const [type, items] of map) {
      if (items.length === 0) map.delete(type)
    }

    return map
  }, [sortedPositions, filterType])

  const totalPortfolioValue = totals.totalValue

  // Movers calculation for real-time impact
  const movers = useMemo(() => {
    return [...positions]
      .filter(p => p.change_amount_24h && Math.abs(p.change_amount_24h) > 0.01)
      .sort((a, b) => (b.change_amount_24h || 0) - (a.change_amount_24h || 0))
  }, [positions])

  const renderAssetCard = (p: EnrichedPosition, i: number) => {
    const card = (
      <MobileAssetCard
        position={p}
        totalPortfolioValue={totalPortfolioValue}
      />
    )

    if (i >= MAX_STAGGERED_ROWS) return card

    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.02, duration: 0.2 }}
      >
        {card}
      </motion.div>
    )
  }

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
        className="sticky top-0 z-20 bg-background/90 border-b border-border/20"
        style={{
          backdropFilter: "blur(28px) saturate(200%)",
          WebkitBackdropFilter: "blur(28px) saturate(200%)",
        }}
      >
        {/* Subtle gradient mesh */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isPositive
              ? "radial-gradient(ellipse 100% 100% at 80% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 60%)"
              : "radial-gradient(ellipse 100% 100% at 80% 0%, rgba(244, 63, 94, 0.08) 0%, transparent 60%)",
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
                className={`flex items-center gap-1.5 mt-0.5 ${isMarketOpen ? "text-emerald-500" : "text-muted-foreground"}`}
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
              className="font-extrabold tracking-tighter leading-none font-display-number transition-all duration-200"
              style={{ fontSize: "clamp(42px, 12vw, 54px)", color: "var(--foreground)" }}
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
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                    scrubData.pnl >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                  }`}
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
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                      isPositive ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                    }`}
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
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
                      daily24Positive ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                    }`}
                  >
                    <span
                      className="text-[11px] font-semibold opacity-70"
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
              <p className="text-[16px] font-extrabold font-tabular mt-0.5" style={{ color: "var(--foreground)" }}>
                {hideBalances ? "••••" : formatCurrency(totals.totalCost)}
              </p>
            </div>
          </div>

          {/* Box 2: Total PnL (Dynamic Color) */}
          <div
            className="flex flex-col justify-between p-4 rounded-[24px] relative overflow-hidden"
            style={{
              background: isPositive ? "linear-gradient(145deg, oklch(0.70 0.21 155 / 0.14), oklch(0.70 0.21 155 / 0.06))" : "linear-gradient(145deg, oklch(0.65 0.22 22 / 0.14), oklch(0.65 0.22 22 / 0.06))",
              border: `1px solid ${isPositive ? "oklch(0.70 0.21 155 / 0.25)" : "oklch(0.65 0.22 22 / 0.25)"}`,
              boxShadow: isPositive ? "0 8px 24px -8px oklch(0.70 0.21 155 / 0.25)" : "0 8px 24px -8px oklch(0.65 0.22 22 / 0.25)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-1.5 rounded-xl"
                style={{
                  background: isPositive ? "oklch(0.70 0.21 155 / 0.15)" : "oklch(0.65 0.22 22 / 0.15)",
                  color: isPositive ? "oklch(0.70 0.21 155)" : "oklch(0.65 0.22 22)"
                }}
              >
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isPositive ? "oklch(0.70 0.21 155)" : "oklch(0.65 0.22 22)", opacity: 0.8 }}>
                Ganancia
              </p>
              <p className="text-[16px] font-extrabold font-tabular mt-0.5" style={{ color: isPositive ? "oklch(0.70 0.21 155)" : "oklch(0.65 0.22 22)" }}>
                {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
              </p>
            </div>
          </div>
          
          {/* Box 3: 24h */}
          <div className="col-span-2">
            <div
              className="flex items-center justify-between p-3 rounded-2xl"
              style={{
                background: daily24Positive ? "oklch(0.70 0.21 155 / 0.10)" : "oklch(0.65 0.22 22 / 0.10)",
                border: `1px solid ${daily24Positive ? "oklch(0.70 0.21 155 / 0.20)" : "oklch(0.65 0.22 22 / 0.20)"}`,
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>Hoy</p>
                <p className="text-[14px] font-bold font-tabular mt.0.5" style={{ color: daily24Positive ? "oklch(0.70 0.21 155)" : "oklch(0.65 0.22 22)" }}>
                  {hideBalances ? "•••" : `${daily24Positive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-bold font-tabular" style={{ color: daily24Positive ? "oklch(0.70 0.21 155)" : "oklch(0.65 0.22 22)", opacity: 0.9 }}>
                  {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Live Market Movers (Top Gainers/Losers) ────────────────────── */}
      {movers.length > 0 && (
        <div className="py-4 mt-2 mb-4 border-y border-border/10 bg-black/5 dark:bg-black/20">
          <div className="flex items-center px-4 mb-3 gap-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
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
                      className={`flex items-center gap-2 px-3 py-2 rounded-[14px] transition-colors border shadow-sm ${
                        isGain ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
                      }`}
                    >
                      <span className="text-[12px] font-extrabold" style={{ color: "var(--foreground)" }}>
                        {p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario" 
                          ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                          : p.ticker.split(".")[0]}
                      </span>
                      <span 
                        className={`text-[12px] font-bold font-tabular flex items-center ${isGain ? "text-emerald-500" : "text-rose-500"}`}
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
          className="sticky z-10 px-4 py-2 bg-background/80 border-b border-border/50"
          style={{
            top: 0,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
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
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-emerald-500"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
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
                    <div key={p.activo_id}>
                      {renderAssetCard(p, i)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat filtered list */
          <div>
            {sortedPositions.map((p, i) => (
              <div key={p.activo_id}>
                {renderAssetCard(p, i)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      {alertsOpen && (
        <Suspense fallback={null}>
          <PriceAlerts
            open={alertsOpen}
            onOpenChange={setAlertsOpen}
            positions={positions}
            checkNotifications={false}
          />
        </Suspense>
      )}
    </div>
  )
}
