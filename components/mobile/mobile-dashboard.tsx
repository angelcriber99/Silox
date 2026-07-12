"use client"

import { lazy, Suspense, useMemo, useState } from "react"
import {
  Bell, Eye, EyeOff, TrendingUp, TrendingDown,
  Wallet, FileUp, ArrowUp, ArrowDown, Plus, LineChart, Settings,
  Search, CalendarDays, PieChart, Activity,
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
import { useQuickAdd } from "@/lib/stores/use-quick-add"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
}

const TYPE_ORDER = ["Fondo Indexado", "ETF", "Fondo Monetario", "Acción", "Crypto", "Metal", "Liquidez"]
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
      className="mx-3 mb-2 mt-4 flex items-center justify-between"
    >
      <span
        className="mobile-caption"
      >
        {label}
      </span>
      <span
        className="rounded px-2 py-0.5 text-[10px] font-extrabold"
        style={{
          color: "var(--muted-foreground)",
          background: "color-mix(in oklch, var(--muted) 72%, transparent)",
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
  const { openEmpty } = useQuickAdd()
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

  const strategySplit = useMemo(() => {
    const relevant = positions.filter(p => p.unidades > 0 && (p.valor_actual ?? 0) > 0)
    const core = relevant
      .filter(p => p.estrategia === "Core")
      .reduce((sum, p) => sum + (p.valor_actual ?? 0), 0)
    const satellite = Math.max(0, totalPortfolioValue - core)
    return {
      core,
      satellite,
      corePct: totalPortfolioValue > 0 ? Math.round((core / totalPortfolioValue) * 100) : 0,
      satellitePct: totalPortfolioValue > 0 ? Math.round((satellite / totalPortfolioValue) * 100) : 0,
    }
  }, [positions, totalPortfolioValue])

  const topPositions = useMemo(() => sortedPositions.slice(0, 4), [sortedPositions])

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
      <div className="mobile-screen px-4 pt-6 pb-32 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 w-24 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
            <div className="h-9 w-9 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
          </div>
        </div>
        <div className="h-14 w-56 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
        <div className="h-5 w-36 rounded-lg animate-pulse" style={{ background: "var(--muted)", opacity: 0.6 }} />
        <div className="h-28 w-full rounded-lg animate-pulse" style={{ background: "var(--muted)", opacity: 0.4 }} />
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 w-28 rounded-lg animate-pulse flex-shrink-0" style={{ background: "var(--muted)", opacity: 0.4 }} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[70px] w-full rounded-lg animate-pulse" style={{ background: "var(--muted)", opacity: 0.3 }} />
        ))}
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="mobile-screen flex min-h-full flex-col">

      {/* ─── Portfolio cover ───────────────────────────────────────────── */}
      <section className="px-4 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}>
        <div className="mb-7 flex items-center justify-between">
          <div>
            <p className="text-[28px] font-black leading-none tracking-normal text-foreground">Silox</p>
            <div className={`mt-2 flex items-center gap-1.5 ${isMarketOpen ? "text-positive" : "text-muted-foreground"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isMarketOpen ? "animate-pulse" : ""}`} style={{ background: "currentcolor" }} />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">{getMarketLabel()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/movimientos"
              className="mobile-focus-ring mobile-panel-muted flex h-10 w-10 items-center justify-center"
              aria-label="Buscar movimientos"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
            </Link>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { hapticFeedback.light(); setAlertsOpen(true) }}
              className="mobile-focus-ring mobile-panel-muted flex h-10 w-10 items-center justify-center"
              aria-label="Alertas de precio"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          </div>
        </div>

        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[30px] font-black leading-tight tracking-normal text-foreground">Portfolio</p>
            <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">Resumen general de cartera</p>
          </div>
          <div className="mobile-panel-muted flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-[11px] font-black text-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            Hoy
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <motion.div
            className="min-w-0 cursor-pointer select-none"
            onDoubleClick={() => {
              hapticFeedback.medium()
              setHideBalances(!hideBalances)
            }}
            whileTap={{ scale: 0.98 }}
          >
            <p className="mobile-caption mb-1">Valor total</p>
            <h1
              className="mobile-value truncate font-black leading-none transition-all duration-200"
              style={{ fontSize: "clamp(40px, 12vw, 56px)", color: "var(--foreground)" }}
            >
              <AnimatedNumber value={scrubData ? scrubData.v : totals.totalValue} format="currency" hide={hideBalances} />
            </h1>
          </motion.div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              hapticFeedback.light()
              setHideBalances(!hideBalances)
            }}
            className={`mobile-focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              hideBalances
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground"
            }`}
            aria-label={hideBalances ? "Mostrar balances" : "Ocultar balances"}
          >
            {hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </motion.button>
        </div>

        {totals.totalCost > 0 && (
          <div className="mt-3 flex min-h-[30px] flex-wrap items-center gap-2">
            {scrubData ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 ${
                  scrubData.pnl >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                }`}
              >
                {scrubData.pnl >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span className="font-tabular text-[14px] font-bold">
                  {hideBalances ? "••••" : `${scrubData.pnl >= 0 ? "+" : ""}${formatCurrency(scrubData.pnl)}`}
                </span>
                <span className="text-[12px] font-semibold opacity-80">vs 7d</span>
              </motion.div>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 ${
                    isPositive ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                  }`}
                >
                  {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  <span className="font-tabular text-[14px] font-bold">
                    {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
                  </span>
                  <span className="text-[12px] font-semibold opacity-80">
                    ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)})
                  </span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${
                    daily24Positive ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                  }`}
                >
                  <span className="text-[11px] font-semibold opacity-70">Hoy</span>
                  <span className="font-tabular text-[13px] font-bold">
                    {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
                  </span>
                </motion.div>
              </>
            )}
          </div>
        )}
      </section>

      {/* ─── Sparkline chart ─────────────────────────────────────────────── */}
      {portfolioSparkline.length > 1 && (
        <div className="mx-4 mb-4 overflow-hidden">
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={portfolioSparkline}
                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                onMouseMove={(e: any) => {
                  if (e.activePayload && e.activePayload.length > 0) {
                    const newScrub = e.activePayload[0].payload
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
                    <stop offset="0%" stopColor={areaColorHex} stopOpacity={0.5} />
                    <stop offset="60%" stopColor={areaColorHex} stopOpacity={0.1} />
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
                  strokeWidth={2.4}
                  fill="url(#mobileGrad)"
                  isAnimationActive
                  animationDuration={700}
                  activeDot={{ r: 5, fill: areaColorHex, stroke: "var(--background)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-md bg-muted/40 p-1">
            {["1D", "1S", "1M", "3M", "YTD", "1A", "TODO"].map((period, index) => (
              <span
                key={period}
                className={`rounded px-2 py-1 text-[10px] font-black ${index === 0 ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
              >
                {period}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Allocation and ledger strip ───────────────────────────────── */}
      <section className="mx-4 mb-4 space-y-3">
        <div className="mobile-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              <p className="text-[13px] font-black text-foreground">Asignación estratégica</p>
            </div>
            <p className="mobile-caption">{positions.filter(p => p.unidades > 0).length} activos</p>
          </div>
          <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-muted">
            <span className="h-full bg-primary" style={{ width: `${strategySplit.corePct}%` }} />
            <span className="h-full bg-amber-500" style={{ width: `${strategySplit.satellitePct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mobile-caption">Core</p>
              <p className="mobile-value text-[18px] font-black text-foreground">{strategySplit.corePct}%</p>
            </div>
            <div className="text-right">
              <p className="mobile-caption">Satellite</p>
              <p className="mobile-value text-[18px] font-black text-foreground">{strategySplit.satellitePct}%</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="mobile-panel-muted min-h-[72px] p-3">
            <Wallet className="mb-2 h-4 w-4 text-primary" />
            <p className="mobile-caption">Invertido</p>
            <p className="mobile-value truncate text-[13px] font-black text-foreground">{hideBalances ? "••••" : formatCurrency(totals.totalCost)}</p>
          </div>
          <div className="mobile-panel-muted min-h-[72px] p-3">
            {isPositive ? <TrendingUp className="mb-2 h-4 w-4 text-positive" /> : <TrendingDown className="mb-2 h-4 w-4 text-negative" />}
            <p className="mobile-caption">Ganancia</p>
            <p className="mobile-value truncate text-[13px] font-black" style={{ color: isPositive ? "var(--positive)" : "var(--negative)" }}>
              {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
            </p>
          </div>
          <div className="mobile-panel-muted min-h-[72px] p-3">
            <Activity className="mb-2 h-4 w-4" style={{ color: daily24Positive ? "var(--positive)" : "var(--negative)" }} />
            <p className="mobile-caption">Hoy</p>
            <p className="mobile-value truncate text-[13px] font-black" style={{ color: daily24Positive ? "var(--positive)" : "var(--negative)" }}>
              {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
            </p>
          </div>
        </div>
      </section>

      {topPositions.length > 0 && (
        <section className="mx-4 mb-4 mobile-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-black text-foreground">Top posiciones</p>
            <span className="mobile-caption">Peso cartera</span>
          </div>
          <div className="space-y-3">
            {topPositions.map((p) => {
              const weight = totalPortfolioValue > 0 ? Math.min(100, ((p.valor_actual ?? 0) / totalPortfolioValue) * 100) : 0
              const isGain = (p.change_percent_24h ?? 0) >= 0
              const ticker = p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
                ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                : p.ticker.split(".")[0]
              return (
                <Link key={p.activo_id} href={`/activo/${p.activo_id}`} className="block">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-[12px] font-black text-foreground">
                      {ticker.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="truncate text-[13px] font-black text-foreground">{ticker}</p>
                        <p className="mobile-value shrink-0 text-[12px] font-black text-foreground">{hideBalances ? "••••" : formatCurrency(p.valor_actual ?? 0)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${weight}%` }} />
                        </div>
                        <span className="w-10 text-right text-[10px] font-black text-muted-foreground">{weight.toFixed(1)}%</span>
                        <span className={`w-14 text-right text-[10px] font-black ${isGain ? "text-positive" : "text-negative"}`}>
                          {hideBalances ? "•••" : formatPercent(p.change_percent_24h ?? 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── Operational shortcuts ─────────────────────────────────────── */}
      <div className="mx-3 mb-4 grid grid-cols-4 gap-2">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            hapticFeedback.medium()
            openEmpty()
          }}
          className="mobile-panel flex min-h-[74px] flex-col items-center justify-center gap-2 px-2 py-3 text-center"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" strokeWidth={2.8} />
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.05em] text-foreground">Añadir</span>
        </motion.button>

        <RevolutSync>
          <div className="mobile-panel flex min-h-[74px] flex-col items-center justify-center gap-2 px-2 py-3 text-center active:scale-95">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
              <FileUp className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.05em] text-foreground">Importar</span>
          </div>
        </RevolutSync>

        <Link href="/analisis" className="mobile-panel flex min-h-[74px] flex-col items-center justify-center gap-2 px-2 py-3 text-center active:scale-95">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
            <LineChart className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.05em] text-foreground">Análisis</span>
        </Link>

        <Link href="/settings" className="mobile-panel flex min-h-[74px] flex-col items-center justify-center gap-2 px-2 py-3 text-center active:scale-95">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Settings className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.05em] text-foreground">Ajustes</span>
        </Link>
      </div>

      {/* ─── Live Market Movers (Top Gainers/Losers) ────────────────────── */}
      {movers.length > 0 && (
        <div className="mx-3 mb-4 mt-1 mobile-panel py-3">
          <div className="flex items-center px-4 mb-3 gap-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <p className="mobile-caption">
              Impacto de mercado
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
                      className="flex items-center gap-2 rounded-md border px-3 py-2 transition-colors"
                      style={{
                        background: isGain ? "color-mix(in oklch, var(--positive) 10%, transparent)" : "color-mix(in oklch, var(--negative) 10%, transparent)",
                        borderColor: isGain ? "color-mix(in oklch, var(--positive) 22%, transparent)" : "color-mix(in oklch, var(--negative) 22%, transparent)",
                      }}
                    >
                      <span className="text-[12px] font-extrabold" style={{ color: "var(--foreground)" }}>
                        {p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario" 
                          ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                          : p.ticker.split(".")[0]}
                      </span>
                      <span 
                        className="mobile-value flex items-center text-[12px] font-black"
                        style={{ color: isGain ? "var(--positive)" : "var(--negative)" }}
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
          className="sticky z-10 px-3 py-2 bg-background/80 border-y border-border/40"
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
                className="relative whitespace-nowrap rounded-md px-3 py-2 text-[11px] font-black uppercase tracking-[0.04em] transition-all"
                style={{
                  color: filterType === type ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  opacity: filterType === type ? 1 : 0.7,
                }}
              >
                {filterType === type && (
                  <motion.div
                    layoutId="filterPill"
                    className="absolute inset-0 rounded-md bg-primary"
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
                    : type === "Metal" ? t("type_metal")
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
        <div className="px-3 pt-3 pb-2">
          <span
            className="mobile-caption"
          >
            {sortedPositions.length} posiciones
          </span>
        </div>

        {sortedPositions.length === 0 ? (
          /* Empty state */
          <div className="mx-3 mobile-panel px-8 py-14 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg"
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
                    : type === "Metal" ? t("type_metal")
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
