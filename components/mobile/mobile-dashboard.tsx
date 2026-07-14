"use client"

import { useMemo, useState } from "react"
import {
  Bell, Eye, EyeOff, TrendingUp, TrendingDown,
  Wallet, FileUp, ArrowUp, ArrowDown, Zap,
} from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts"
import type { MouseHandlerDataParam } from "recharts"
import { usePreferences } from "@/lib/stores/use-preferences"
import { hapticFeedback } from "@/lib/utils/haptics"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { useHistory } from "@/lib/hooks/use-portfolio"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import Link from "next/link"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
}

// ── Type color map ─────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  "ETF":             "#0A84FF",
  "Fondo Indexado":  "#BF5AF2",
  "Fondo Monetario": "#32ADE6",
  "Acción":          "#FFD60A",
  "Crypto":          "#FF9F0A",
  "Liquidez":        "#98989D",
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ label, count, color }: { label: string; count: number; color?: string }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-2">
      <div className="flex items-center gap-2">
        {color && (
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: color }}
          />
        )}
        <span
          className="text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          {label}
        </span>
      </div>
      <span
        className="text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
        style={{
          color: "rgba(255,255,255,0.40)",
          background: "rgba(255,255,255,0.07)",
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

  const isPositive     = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0
  const areaColorHex   = isPositive ? "#30D158" : "#FF453A"

  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  const getMarketLabel = () => {
    switch (marketState) {
      case "REGULAR": return t("market_open")
      case "PRE":     return t("market_pre")
      case "POST":    return t("market_post")
      default:        return t("market_closed")
    }
  }

  // Portfolio chart data
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
      case "1W": cutoff.setDate(now.getDate() - 7); break
      case "1M": cutoff.setMonth(now.getMonth() - 1); break
      case "3M": cutoff.setMonth(now.getMonth() - 3); break
      case "YTD": cutoff.setFullYear(now.getFullYear(), 0, 1); break
      case "1Y": cutoff.setFullYear(now.getFullYear() - 1); break
      case "MAX": cutoff.setFullYear(2000); break
    }

    filtered = filtered.filter(s => new Date(s.timestamp) >= cutoff)

    if (filtered.length < 2) {
      filtered = Array.from(dailySnapshots.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-2)
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

  const movers = useMemo(() => {
    return [...positions]
      .filter(p => p.change_amount_24h && Math.abs(p.change_amount_24h) > 0.01)
      .sort((a, b) => Math.abs(b.change_amount_24h || 0) - Math.abs(a.change_amount_24h || 0))
      .slice(0, 8)
  }, [positions])

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-4 pt-6 pb-32 space-y-5">
        <div className="flex justify-between items-center">
          <div className="space-y-1.5">
            <div className="h-3 w-20 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-12 w-48 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="h-4 w-32 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-10 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="h-10 w-10 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>
        </div>
        <div className="h-[160px] w-full rounded-3xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[76px] w-full rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        ))}
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--background)" }}>

      {/* ─── Sticky header ────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: "rgba(8,8,10,0.90)",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Dynamic color accent */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isPositive
              ? "radial-gradient(ellipse 70% 80% at 90% 0%, rgba(48,209,88,0.07) 0%, transparent 70%)"
              : "radial-gradient(ellipse 70% 80% at 90% 0%, rgba(255,69,58,0.07) 0%, transparent 70%)",
          }}
        />

        <div
          className="px-5 pb-5 relative"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
        >
          {/* Top row: label + actions */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "rgba(255,255,255,0.40)" }}
                >
                  Patrimonio total
                </span>
                {/* Market status pill */}
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{
                    background: isMarketOpen ? "rgba(48,209,88,0.12)" : "rgba(255,255,255,0.06)",
                    border: `0.5px solid ${isMarketOpen ? "rgba(48,209,88,0.30)" : "rgba(255,255,255,0.10)"}`,
                  }}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isMarketOpen ? "animate-pulse" : ""}`}
                    style={{ background: isMarketOpen ? "#30D158" : "rgba(255,255,255,0.30)" }}
                  />
                  <span
                    className="text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: isMarketOpen ? "#30D158" : "rgba(255,255,255,0.35)" }}
                  >
                    {getMarketLabel()}
                  </span>
                </div>
              </div>

              {/* Main value */}
              <motion.div
                className="cursor-pointer select-none"
                onDoubleClick={() => { hapticFeedback.medium(); setHideBalances(!hideBalances) }}
                whileTap={{ scale: 0.98 }}
              >
                <h1
                  className="font-extrabold leading-none"
                  style={{
                    fontSize: "clamp(40px, 11vw, 56px)",
                    letterSpacing: "-0.04em",
                    fontVariantNumeric: "tabular-nums",
                    color: "#FFFFFF",
                  }}
                >
                  <AnimatedNumber
                    value={scrubData ? scrubData.v : totals.totalValue}
                    format="currency"
                    hide={hideBalances}
                  />
                </h1>
              </motion.div>

              {/* PnL row */}
              {totals.totalCost > 0 && !scrubData && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Total PnL */}
                  <div
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                    style={{
                      background: isPositive ? "rgba(48,209,88,0.13)" : "rgba(255,69,58,0.13)",
                      border: `0.5px solid ${isPositive ? "rgba(48,209,88,0.25)" : "rgba(255,69,58,0.25)"}`,
                    }}
                  >
                    {isPositive
                      ? <ArrowUp className="w-3 h-3" style={{ color: "#30D158" }} />
                      : <ArrowDown className="w-3 h-3" style={{ color: "#FF453A" }} />}
                    <span
                      className="text-[13px] font-bold tabular-nums"
                      style={{ color: isPositive ? "#30D158" : "#FF453A" }}
                    >
                      {hideBalances ? "••••" : formatPnl(totals.totalPnl)}
                    </span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: isPositive ? "rgba(48,209,88,0.75)" : "rgba(255,69,58,0.75)" }}
                    >
                      {hideBalances ? "" : `(${formatPercent(totals.totalPnlPercent)})`}
                    </span>
                  </div>

                  {/* 24h badge */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: daily24Positive ? "rgba(48,209,88,0.08)" : "rgba(255,69,58,0.08)",
                      border: `0.5px solid ${daily24Positive ? "rgba(48,209,88,0.18)" : "rgba(255,69,58,0.18)"}`,
                    }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      Hoy
                    </span>
                    <span
                      className="text-[12px] font-bold tabular-nums"
                      style={{ color: daily24Positive ? "#30D158" : "#FF453A" }}
                    >
                      {hideBalances
                        ? "•••"
                        : `${daily24Positive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}
                    </span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: daily24Positive ? "rgba(48,209,88,0.70)" : "rgba(255,69,58,0.70)" }}
                    >
                      {hideBalances ? "" : formatPercent(totals.totalPnlPercent24h)}
                    </span>
                  </div>
                </div>
              )}

              {/* Scrub overlay */}
              {scrubData && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full mt-2 w-fit"
                  style={{
                    background: scrubData.pnl >= 0 ? "rgba(48,209,88,0.15)" : "rgba(255,69,58,0.15)",
                    border: `0.5px solid ${scrubData.pnl >= 0 ? "rgba(48,209,88,0.30)" : "rgba(255,69,58,0.30)"}`,
                    color: scrubData.pnl >= 0 ? "#30D158" : "#FF453A",
                  }}
                >
                  {scrubData.pnl >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  <span className="text-[13px] font-bold tabular-nums">
                    {hideBalances ? "••••" : formatPnl(scrubData.pnl)}
                  </span>
                  <span className="text-[10px] font-semibold opacity-70">vs {chartRange}</span>
                </motion.div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 mt-1">
              <RevolutSync>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "0.5px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  <FileUp className="w-4 h-4" />
                </div>
              </RevolutSync>

              <motion.button
                whileTap={{ scale: 0.90 }}
                onClick={() => { hapticFeedback.light(); setAlertsOpen(true) }}
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "0.5px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.55)",
                }}
                aria-label="Alertas de precio"
              >
                <Bell className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.90 }}
                onClick={() => { hapticFeedback.light(); setHideBalances(!hideBalances) }}
                className="h-10 w-10 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: hideBalances ? "rgba(48,209,88,0.12)" : "rgba(255,255,255,0.07)",
                  border: hideBalances ? "0.5px solid rgba(48,209,88,0.30)" : "0.5px solid rgba(255,255,255,0.10)",
                  color: hideBalances ? "#30D158" : "rgba(255,255,255,0.55)",
                }}
                aria-label={hideBalances ? "Mostrar balances" : "Ocultar balances"}
              >
                {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sparkline chart ───────────────────────────────────────────── */}
      {portfolioSparkline.length > 1 && (
        <div className="h-[160px] w-full relative" style={{ marginTop: -2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={portfolioSparkline}
              margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
              onMouseMove={(event: MouseHandlerDataParam) => {
                const index = Number(event.activeTooltipIndex)
                if (event.isTooltipActive && Number.isInteger(index)) {
                  const newScrub = portfolioSparkline[index]
                  if (!newScrub) return
                  setScrubData(prev => {
                    if (prev?.i !== newScrub.i) hapticFeedback.light()
                    return newScrub
                  })
                }
              }}
              onMouseLeave={() => setScrubData(null)}
              onTouchEnd={() => setScrubData(null)}
            >
              <defs>
                <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={areaColorHex} stopOpacity={0.45} />
                  <stop offset="65%"  stopColor={areaColorHex} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={areaColorHex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin - 300", "dataMax + 300"]} />
              <Tooltip
                content={() => null}
                cursor={{ stroke: areaColorHex, strokeWidth: 1.5, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColorHex}
                strokeWidth={2.5}
                fill="url(#mobileGrad)"
                isAnimationActive
                animationDuration={700}
                activeDot={{ r: 5, fill: areaColorHex, stroke: "var(--background)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Chart Range Selector ─────────────────────────────────────── */}
      <div className="px-4 pb-5 pt-2 flex gap-1">
        {(["1W", "1M", "3M", "YTD", "1Y", "MAX"] as const).map(range => (
          <button
            key={range}
            onClick={() => { hapticFeedback.light(); setChartRange(range) }}
            className="flex-1 py-2 text-[11px] font-bold rounded-xl transition-all relative overflow-hidden"
            style={{
              color: chartRange === range ? "#FFFFFF" : "rgba(255,255,255,0.30)",
              background: chartRange === range ? "rgba(255,255,255,0.12)" : "transparent",
            }}
          >
            {range}
          </button>
        ))}
      </div>

      {/* ─── Metric Cards (3-column bento) ─────────────────────────── */}
      <div className="px-4 pb-5">
        <div className="grid grid-cols-3 gap-3">
          {/* Invested */}
          <div
            className="flex flex-col justify-between p-4 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <Wallet className="w-4 h-4 mb-3" style={{ color: "rgba(255,255,255,0.40)" }} />
            <div>
              <p
                className="text-[17px] font-extrabold tabular-nums leading-tight"
                style={{ color: "#FFFFFF", letterSpacing: "-0.03em" }}
              >
                {hideBalances ? "••••" : formatCurrency(totals.totalCost)}
              </p>
              <p
                className="text-[9px] font-bold uppercase tracking-wider mt-1"
                style={{ color: "rgba(255,255,255,0.30)" }}
              >
                Invertido
              </p>
            </div>
          </div>

          {/* Total gain */}
          <div
            className="flex flex-col justify-between p-4 rounded-2xl"
            style={{
              background: isPositive ? "rgba(48,209,88,0.09)" : "rgba(255,69,58,0.09)",
              border: `0.5px solid ${isPositive ? "rgba(48,209,88,0.20)" : "rgba(255,69,58,0.20)"}`,
            }}
          >
            {isPositive
              ? <TrendingUp className="w-4 h-4 mb-3" style={{ color: "#30D158" }} />
              : <TrendingDown className="w-4 h-4 mb-3" style={{ color: "#FF453A" }} />}
            <div>
              <p
                className="text-[17px] font-extrabold tabular-nums leading-tight"
                style={{ color: isPositive ? "#30D158" : "#FF453A", letterSpacing: "-0.03em" }}
              >
                {hideBalances ? "••••" : formatPnl(totals.totalPnl)}
              </p>
              <p
                className="text-[9px] font-bold uppercase tracking-wider mt-1"
                style={{ color: isPositive ? "rgba(48,209,88,0.55)" : "rgba(255,69,58,0.55)" }}
              >
                Ganancia
              </p>
            </div>
          </div>

          {/* 24h */}
          <div
            className="flex flex-col justify-between p-4 rounded-2xl"
            style={{
              background: daily24Positive ? "rgba(48,209,88,0.07)" : "rgba(255,69,58,0.07)",
              border: `0.5px solid ${daily24Positive ? "rgba(48,209,88,0.15)" : "rgba(255,69,58,0.15)"}`,
            }}
          >
            <Zap className="w-4 h-4 mb-3" style={{ color: daily24Positive ? "rgba(48,209,88,0.60)" : "rgba(255,69,58,0.60)" }} />
            <div>
              <p
                className="text-[17px] font-extrabold tabular-nums leading-tight"
                style={{ color: daily24Positive ? "#30D158" : "#FF453A", letterSpacing: "-0.03em" }}
              >
                {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
              </p>
              <p
                className="text-[9px] font-bold uppercase tracking-wider mt-1"
                style={{ color: daily24Positive ? "rgba(48,209,88,0.55)" : "rgba(255,69,58,0.55)" }}
              >
                Hoy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Live Market Movers ───────────────────────────────────────── */}
      {movers.length > 0 && (
        <div
          className="pb-5"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center px-4 pt-4 mb-3 gap-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#30D158" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#30D158" }} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.35)" }}>
              Impacto hoy
            </p>
          </div>

          <div className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory px-4 pb-1 gap-2.5 scroll-smooth">
            {movers.map(p => {
              const isGain = (p.change_amount_24h || 0) >= 0
              const ticker = p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
                ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                : p.ticker.split(".")[0]
              return (
                <Link key={p.activo_id} href={`/activo/${p.activo_id}`} className="snap-center shrink-0">
                  <motion.div
                    whileTap={{ scale: 0.94 }}
                    className="flex flex-col gap-0.5 px-3.5 py-2.5 rounded-2xl"
                    style={{
                      background: isGain ? "rgba(48,209,88,0.09)" : "rgba(255,69,58,0.09)",
                      border: `0.5px solid ${isGain ? "rgba(48,209,88,0.20)" : "rgba(255,69,58,0.20)"}`,
                      minWidth: 90,
                    }}
                  >
                    <span className="text-[13px] font-extrabold" style={{ color: "#FFFFFF" }}>
                      {ticker}
                    </span>
                    <span
                      className="text-[12px] font-bold tabular-nums"
                      style={{ color: isGain ? "#30D158" : "#FF453A" }}
                    >
                      {isGain ? "+" : ""}{hideBalances ? "•••" : formatCurrency(p.change_amount_24h || 0)}
                    </span>
                    <span
                      className="text-[10px] font-semibold tabular-nums"
                      style={{ color: isGain ? "rgba(48,209,88,0.65)" : "rgba(255,69,58,0.65)" }}
                    >
                      {hideBalances ? "•••" : formatPercent(p.change_percent_24h ?? 0)}
                    </span>
                  </motion.div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Asset filter pills ───────────────────────────────────────── */}
      {assetTypes.length > 2 && (
        <div
          className="sticky z-10 px-4 py-3"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 72px)",
            background: "rgba(8,8,10,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "0.5px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {assetTypes.map(type => {
              const isSelected = filterType === type
              const typeColor = TYPE_COLORS[type] || "#98989D"
              const label = type === "All" ? t("filter_all")
                : type === "Fondo Indexado" ? t("type_index_fund")
                : type === "Fondo Monetario" ? t("type_money_market")
                : type === "Acción" ? t("type_stock")
                : type === "Crypto" ? t("type_crypto")
                : type === "ETF" ? t("type_etf")
                : type

              return (
                <button
                  key={type}
                  onClick={() => { hapticFeedback.light(); setFilterType(type) }}
                  className="whitespace-nowrap px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all flex-shrink-0"
                  style={{
                    color: isSelected ? "#000000" : "rgba(255,255,255,0.45)",
                    background: isSelected
                      ? (type === "All" ? "#FFFFFF" : typeColor)
                      : "rgba(255,255,255,0.07)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Asset list ──────────────────────────────────────────────── */}
      <div className="pb-36 pt-2">
        {sortedPositions.length === 0 ? (
          <div className="text-center py-20 px-8">
            <div
              className="h-16 w-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              <Wallet className="w-8 h-8" style={{ color: "rgba(255,255,255,0.25)" }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
              Sin posiciones abiertas
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
              Pulsa el botón + para añadir tu primera posición
            </p>
          </div>
        ) : grouped ? (
          <div>
            {Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type}>
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
                  color={TYPE_COLORS[type]}
                />
                <div>
                  {items.map((p, i) => (
                    <motion.div
                      key={p.activo_id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.28 }}
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
          <div>
            {sortedPositions.map((p, i) => (
              <motion.div
                key={p.activo_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.28 }}
              >
                <MobileAssetCard position={p} totalPortfolioValue={totalPortfolioValue} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────── */}
      <PriceAlerts open={alertsOpen} onOpenChange={setAlertsOpen} />
    </div>
  )
}
