"use client"

import { useState } from "react"
import type { EnrichedPosition } from '@/lib/types'
import { formatPercent, formatPnl } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown, Zap } from "lucide-react"
import { useTranslations } from "next-intl"
import { usePreferences } from "@/lib/stores/use-preferences"
import { motion } from "framer-motion"

export function TopMovers({ positions, marketState = 'CLOSED' }: { positions: EnrichedPosition[], marketState?: string }) {
  const [sortBy, setSortBy] = useState<"percent" | "amount">("amount")
  const t = useTranslations('Dashboard')
  const { hideBalances } = usePreferences()

  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  const validPositions = positions.filter(p => {
    if (p.tipo === 'Liquidez' || p.ticker === 'CASH') return false
    if (sortBy === "percent") {
      return typeof p.change_percent_24h === 'number' && p.change_percent_24h !== 0 && p.unidades > 0
    } else {
      return typeof p.change_amount_24h === 'number' && p.change_amount_24h !== 0 && p.unidades > 0
    }
  })

  const sorted = [...validPositions].sort((a, b) => {
    if (sortBy === "percent") return (b.change_percent_24h || 0) - (a.change_percent_24h || 0)
    return (b.change_amount_24h || 0) - (a.change_amount_24h || 0)
  })

  const best = sorted.filter(p => sortBy === "percent" ? p.change_percent_24h! > 0 : p.change_amount_24h! > 0)
  const worst = sorted.slice().reverse().filter(p => sortBy === "percent" ? p.change_percent_24h! < 0 : p.change_amount_24h! < 0)

  const getDisplayName = (p: EnrichedPosition) => {
    if (p.nombre?.toUpperCase().includes("MSCI")) return "MSCI"
    if (p.ticker.startsWith("0P")) return (p.nombre || p.ticker).split(' ')[0]
    return p.ticker.split('.')[0]
  }

  return (
    <div
      className="rounded-2xl flex flex-col h-full overflow-hidden"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(48,209,88,0.12)" }}
          >
            <Zap className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Resumen Diario
          </span>
          {/* Market status dot */}
          <span
            className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? "animate-pulse" : ""}`}
            style={{
              background: isMarketOpen
                ? "#30D158"
                : "rgba(255,255,255,0.2)",
            }}
          />
        </div>

        {/* Sort toggle */}
        <div
          className="flex rounded-lg p-0.5 gap-0.5"
          style={{ background: "var(--muted)" }}
        >
          {(["amount", "percent"] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className="px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-200"
              style={{
                background: sortBy === opt ? "var(--background)" : "transparent",
                color: sortBy === opt ? "var(--foreground)" : "var(--muted-foreground)",
                boxShadow: sortBy === opt ? "0 1px 3px oklch(0 0 0 / 0.15)" : "none",
              }}
            >
              {opt === "amount" ? "€" : "%"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 grid grid-cols-2 gap-4 flex-1 overflow-y-auto hide-scrollbar">
        {/* Winners */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: "#30D158" }} />
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#30D158" }}
            >
              {t('winners')}
            </span>
          </div>

          {best.length > 0 ? (
            best.slice(0, 4).map((p, i) => (
              <motion.div
                key={p.ticker}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex justify-between items-center gap-2"
              >
                <span
                  className="text-[12px] font-medium truncate flex-1 flex items-center gap-1.5"
                  style={{ color: "var(--foreground)" }}
                  title={p.nombre || p.ticker}
                >
                  <span>{getDisplayName(p)}</span>
                  {p.change_percent_24h && p.change_percent_24h >= 3 ? (
                    <span title="¡Activo on fire! (>3% de subida hoy)" className="animate-pulse">🔥</span>
                  ) : null}
                </span>
                <span
                  className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{
                    color: "#30D158",
                    background: "rgba(48,209,88,0.10)",
                  }}
                >
                  {sortBy === "percent"
                    ? formatPercent(p.change_percent_24h || 0)
                    : hideBalances ? "***" : formatPnl(p.change_amount_24h!)}
                </span>
              </motion.div>
            ))
          ) : (
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
              {!isMarketOpen ? t('market_closed') : t('all_red')}
            </span>
          )}
        </div>

        {/* Losers */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingDown className="w-3.5 h-3.5" style={{ color: "#FF453A" }} />
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#FF453A" }}
            >
              {t('losers')}
            </span>
          </div>

          {worst.length > 0 ? (
            worst.slice(0, 4).map((p, i) => (
              <motion.div
                key={p.ticker}
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex justify-between items-center gap-2"
              >
                <span
                  className="text-[12px] font-medium truncate flex-1"
                  style={{ color: "var(--foreground)" }}
                  title={p.nombre || p.ticker}
                >
                  {getDisplayName(p)}
                </span>
                <span
                  className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{
                    color: "#FF453A",
                    background: "rgba(255,69,58,0.10)",
                  }}
                >
                  {sortBy === "percent"
                    ? formatPercent(p.change_percent_24h || 0)
                    : hideBalances ? "***" : formatPnl(p.change_amount_24h!)}
                </span>
              </motion.div>
            ))
          ) : (
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
              {!isMarketOpen ? t('market_closed') : t('all_green')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
