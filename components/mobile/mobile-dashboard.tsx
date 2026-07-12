"use client"

import { lazy, Suspense, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Eye,
  EyeOff,
  FileUp,
  LineChart,
  Radio,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { usePreferences } from "@/lib/stores/use-preferences"
import { hapticFeedback } from "@/lib/utils/haptics"
import { useHistory } from "@/lib/hooks/use-portfolio"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import { useAlerts } from "@/lib/hooks/use-alerts"
import { usePriceAlertNotifications } from "@/components/dashboard/use-price-alert-notifications"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
}

type SparklinePointerState = {
  activePayload?: Array<{ payload: { i: number; v: number; pnl: number } }>
}

function getSparklinePayload(event: unknown) {
  const maybeEvent = event as SparklinePointerState
  return maybeEvent.activePayload?.[0]?.payload ?? null
}

const TYPE_ORDER = ["Fondo Indexado", "ETF", "Fondo Monetario", "Acción", "Crypto", "Metal", "Liquidez"]
const MAX_STAGGERED_ROWS = 12
const PriceAlerts = lazy(() =>
  import("@/components/dashboard/price-alerts").then((mod) => ({
    default: mod.PriceAlerts,
  }))
)

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-5 pb-2 pt-6">
      <span className="text-[11px] font-black uppercase text-[var(--mobile-ink)]">
        {label}
      </span>
      <span className="font-tabular text-[11px] font-bold text-[var(--mobile-muted)]">
        {count.toString().padStart(2, "0")}
      </span>
    </div>
  )
}

function MetricTile({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string
  value: string
  icon: ReactNode
  tone?: "neutral" | "positive" | "negative"
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--mobile-positive)]"
      : tone === "negative"
        ? "text-[var(--mobile-negative)]"
        : "text-[var(--mobile-ink)]"

  return (
    <div className="min-w-[142px] border-l border-[var(--mobile-line)] px-3 py-2 first:border-l-0">
      <div className="mb-2 flex items-center gap-2 text-[var(--mobile-muted)]">
        {icon}
        <span className="text-[9px] font-black uppercase">{label}</span>
      </div>
      <p className={`font-tabular text-[14px] font-black ${toneClass}`}>{value}</p>
    </div>
  )
}

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
  const areaColorHex = isPositive ? "#2f8f63" : "#c94445"
  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  const getMarketLabel = () => {
    switch (marketState) {
      case "REGULAR": return t("market_open")
      case "PRE":     return t("market_pre")
      case "POST":    return t("market_post")
      default:        return t("market_closed")
    }
  }

  const portfolioSparkline = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    const dailySnapshots = new Map<string, typeof snapshots[0]>()
    sorted.forEach((s) => {
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

  const sortedPositions = useMemo(() => {
    let result = [...positions].filter((p) => p.unidades > 0)
    if (filterType !== "All") result = result.filter((p) => p.tipo === filterType)
    return result.sort((a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0))
  }, [positions, filterType])

  const assetTypes = useMemo(() => {
    const types = new Set(positions.filter((p) => p.unidades > 0).map((p) => p.tipo))
    return ["All", ...Array.from(types)]
  }, [positions])

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

  const movers = useMemo(() => {
    return [...positions]
      .filter((p) => p.change_amount_24h && Math.abs(p.change_amount_24h) > 0.01)
      .sort((a, b) => Math.abs(b.change_amount_24h || 0) - Math.abs(a.change_amount_24h || 0))
      .slice(0, 8)
  }, [positions])

  const totalPortfolioValue = totals.totalValue

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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.015, duration: 0.18 }}
      >
        {card}
      </motion.div>
    )
  }

  if (isLoading) {
    return (
      <div className="mobile-redesign min-h-full px-5 pb-32 pt-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse bg-[var(--mobile-line)]" />
          <div className="flex gap-2">
            <div className="h-10 w-10 animate-pulse bg-[var(--mobile-line)]" />
            <div className="h-10 w-10 animate-pulse bg-[var(--mobile-line)]" />
          </div>
        </div>
        <div className="h-16 w-64 animate-pulse bg-[var(--mobile-line)]" />
        <div className="mt-5 h-36 w-full animate-pulse bg-[var(--mobile-line)]" />
        <div className="mt-5 flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 min-w-[142px] animate-pulse bg-[var(--mobile-line)]" />
          ))}
        </div>
        <div className="mt-8 space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[72px] w-full animate-pulse border-y border-[var(--mobile-line)] bg-[var(--mobile-paper)]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-redesign flex min-h-full flex-col bg-[var(--mobile-canvas)] text-[var(--mobile-ink)]">
      <div
        className="sticky top-0 z-20 border-b border-[var(--mobile-line)] bg-[var(--mobile-canvas)]/95"
        style={{ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
      >
        <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[18px] font-black leading-none">Silox</p>
              <div className={`mt-1 flex items-center gap-1.5 ${isMarketOpen ? "text-[var(--mobile-positive)]" : "text-[var(--mobile-muted)]"}`}>
                <Radio className="h-3 w-3" />
                <span className="text-[10px] font-black uppercase">{getMarketLabel()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RevolutSync>
                <button
                  type="button"
                  className="mobile-icon-button"
                  aria-label="Importar movimientos"
                >
                  <FileUp className="h-4 w-4" />
                </button>
              </RevolutSync>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => { hapticFeedback.light(); setAlertsOpen(true) }}
                className="mobile-icon-button"
                aria-label="Alertas de precio"
              >
                <Bell className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  hapticFeedback.light()
                  setHideBalances(!hideBalances)
                }}
                className="mobile-icon-button"
                aria-label={hideBalances ? "Mostrar balances" : "Ocultar balances"}
              >
                {hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </motion.button>
            </div>
          </div>

          <motion.div
            className="select-none"
            onDoubleClick={() => {
              hapticFeedback.medium()
              setHideBalances(!hideBalances)
            }}
            whileTap={{ scale: 0.985 }}
          >
            <p className="mb-2 text-[10px] font-black uppercase text-[var(--mobile-muted)]">Patrimonio</p>
            <h1 className="font-display-number text-[48px] font-black leading-[0.92] text-[var(--mobile-ink)]">
              <AnimatedNumber value={scrubData ? scrubData.v : totals.totalValue} format="currency" hide={hideBalances} />
            </h1>
          </motion.div>

          {totals.totalCost > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <div className={`mobile-signal ${scrubData ? scrubData.pnl >= 0 ? "is-positive" : "is-negative" : isPositive ? "is-positive" : "is-negative"}`}>
                {scrubData ? (
                  <>
                    {scrubData.pnl >= 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    <span>{hideBalances ? "••••" : `${scrubData.pnl >= 0 ? "+" : ""}${formatCurrency(scrubData.pnl)}`}</span>
                    <span className="opacity-[0.65]">7d</span>
                  </>
                ) : (
                  <>
                    {isPositive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    <span>{hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}</span>
                    <span className="opacity-[0.65]">{hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)}</span>
                  </>
                )}
              </div>
              <div className={`mobile-signal ${daily24Positive ? "is-positive" : "is-negative"}`}>
                <span>Hoy</span>
                <span>{hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {portfolioSparkline.length > 1 && (
        <div className="relative h-[152px] border-b border-[var(--mobile-line)] bg-[var(--mobile-paper)]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={portfolioSparkline}
              margin={{ top: 22, right: 0, left: 0, bottom: 0 }}
              onMouseMove={(e: unknown) => {
                const newScrub = getSparklinePayload(e)
                if (newScrub) {
                  setScrubData((prev) => {
                    if (prev?.i !== newScrub.i) hapticFeedback.light()
                    return newScrub
                  })
                }
              }}
              onMouseLeave={() => setScrubData(null)}
              onTouchEnd={() => setScrubData(null)}
            >
              <defs>
                <linearGradient id="mobileEditorialGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColorHex} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={areaColorHex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin - 300", "dataMax + 300"]} />
              <Tooltip content={() => null} cursor={{ stroke: "#2b2b2b", strokeWidth: 1, strokeDasharray: "3 5" }} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColorHex}
                strokeWidth={2.5}
                fill="url(#mobileEditorialGrad)"
                isAnimationActive
                animationDuration={650}
                activeDot={{ r: 4, fill: areaColorHex, stroke: "var(--mobile-canvas)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="border-b border-[var(--mobile-line)] bg-[var(--mobile-canvas)]">
        <div className="flex overflow-x-auto px-2 hide-scrollbar">
          <MetricTile
            label="Invertido"
            value={hideBalances ? "••••" : formatCurrency(totals.totalCost)}
            icon={<Wallet className="h-3.5 w-3.5" />}
          />
          <MetricTile
            label="Ganancia"
            value={hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
            icon={isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            tone={isPositive ? "positive" : "negative"}
          />
          <MetricTile
            label="Hoy"
            value={hideBalances ? "•••" : `${daily24Positive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}
            icon={<LineChart className="h-3.5 w-3.5" />}
            tone={daily24Positive ? "positive" : "negative"}
          />
        </div>
      </div>

      {movers.length > 0 && (
        <div className="border-b border-[var(--mobile-line)] bg-[var(--mobile-paper)] py-3">
          <div className="mb-2 flex items-center gap-2 px-5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mobile-positive)]" />
            <p className="text-[10px] font-black uppercase text-[var(--mobile-muted)]">Impacto hoy</p>
          </div>
          <div className="flex gap-2 overflow-x-auto px-5 hide-scrollbar">
            {movers.map((p) => {
              const isGain = (p.change_amount_24h || 0) >= 0
              return (
                <Link key={p.activo_id} href={`/activo/${p.activo_id}`} className="shrink-0">
                  <motion.div
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-2 border border-[var(--mobile-line)] bg-[var(--mobile-canvas)] px-3 py-2"
                  >
                    <span className="text-[11px] font-black">
                      {p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
                        ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                        : p.ticker.split(".")[0]}
                    </span>
                    <span className={`font-tabular text-[11px] font-black ${isGain ? "text-[var(--mobile-positive)]" : "text-[var(--mobile-negative)]"}`}>
                      {isGain ? "+" : ""}{hideBalances ? "•••" : formatCurrency(p.change_amount_24h || 0)}
                    </span>
                  </motion.div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {assetTypes.length > 2 && (
        <div className="sticky top-[118px] z-10 border-b border-[var(--mobile-line)] bg-[var(--mobile-canvas)]/95 px-5 py-3 backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {assetTypes.map((type) => {
              const active = filterType === type
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`h-8 shrink-0 border px-3 text-[11px] font-black uppercase transition-colors ${
                    active
                      ? "border-[var(--mobile-ink)] bg-[var(--mobile-ink)] text-[var(--mobile-canvas)]"
                      : "border-[var(--mobile-line)] bg-[var(--mobile-paper)] text-[var(--mobile-muted)]"
                  }`}
                >
                  {type === "All"
                    ? t("filter_all")
                    : type === "Fondo Indexado" ? t("type_index_fund")
                    : type === "Fondo Monetario" ? t("type_money_market")
                    : type === "Acción" ? t("type_stock")
                    : type === "Crypto" ? t("type_crypto")
                    : type === "Metal" ? t("type_metal")
                    : type === "ETF" ? t("type_etf")
                    : type}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="pb-32">
        <div className="px-5 pt-5">
          <div className="flex items-end justify-between border-b border-[var(--mobile-line)] pb-2">
            <p className="text-[18px] font-black">Activos</p>
            <p className="font-tabular text-[11px] font-bold text-[var(--mobile-muted)]">{sortedPositions.length} posiciones</p>
          </div>
        </div>

        {sortedPositions.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-[var(--mobile-line)] bg-[var(--mobile-paper)]">
              <Wallet className="h-7 w-7 text-[var(--mobile-muted)]" />
            </div>
            <p className="text-sm font-black">Sin posiciones abiertas</p>
            <p className="mt-1 text-xs text-[var(--mobile-muted)]">Pulsa el botón + para añadir tu primera posición</p>
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
                    : type === "Metal" ? t("type_metal")
                    : type === "ETF" ? t("type_etf")
                    : type
                  }
                  count={items.length}
                />
                <div className="border-t border-[var(--mobile-line)]">
                  {items.map((p, i) => (
                    <div key={p.activo_id}>{renderAssetCard(p, i)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 border-t border-[var(--mobile-line)]">
            {sortedPositions.map((p, i) => (
              <div key={p.activo_id}>{renderAssetCard(p, i)}</div>
            ))}
          </div>
        )}
      </div>

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
