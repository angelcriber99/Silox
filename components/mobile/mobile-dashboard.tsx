"use client"

import { useMemo, useState } from "react"
import {
  Bell, Eye, EyeOff, FileUp, Wallet
} from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { usePreferences } from "@/lib/stores/use-preferences"
import { hapticFeedback } from "@/lib/utils/haptics"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
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
  const t = useTranslations("Dashboard")

  const isPositive     = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0

  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  const getMarketLabel = () => {
    switch (marketState) {
      case "REGULAR": return t("market_open")
      case "PRE":     return t("market_pre")
      case "POST":    return t("market_post")
      default:        return t("market_closed")
    }
  }



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
                    value={totals.totalValue}
                    format="currency"
                    hide={hideBalances}
                  />
                </h1>
              </motion.div>

              {/* PnL row */}
              {totals.totalCost > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Total PnL */}
                  <div
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                    style={{
                      background: isPositive ? "rgba(48,209,88,0.13)" : "rgba(255,69,58,0.13)",
                      border: `0.5px solid ${isPositive ? "rgba(48,209,88,0.25)" : "rgba(255,69,58,0.25)"}`,
                    }}
                  >
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
                      {hideBalances ? "" : `(${formatPercent(totals.totalPnlPercent).replace('+', '')})`}
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
                      {hideBalances ? "" : `(${formatPercent(totals.totalPnlPercent24h).replace('+', '')})`}
                    </span>
                  </div>
                </div>
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
                        totalPortfolioValue={totals.totalValue}
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
                <MobileAssetCard position={p} totalPortfolioValue={totals.totalValue} />
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
