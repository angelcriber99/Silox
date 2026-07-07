"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { ChevronRight } from "lucide-react"
import { motion } from "framer-motion"

interface MobileAssetCardProps {
  position: EnrichedPosition
  totalPortfolioValue: number
}

// Type configuration with wealth-teal-aware palette
const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  "ETF":              { color: "oklch(0.60 0.17 270)", label: "ETF"       },
  "Fondo Indexado":   { color: "oklch(0.65 0.17 310)", label: "Fondo"     },
  "Fondo Monetario":  { color: "oklch(0.68 0.17 192)", label: "Monetario" },
  "Acción":           { color: "oklch(0.72 0.15 55)",  label: "Acción"    },
  "Crypto":           { color: "oklch(0.70 0.18 30)",  label: "Crypto"    },
  "Liquidez":         { color: "oklch(0.60 0.016 230)",label: "Efectivo"  },
}

export const MobileAssetCard = React.memo(function MobileAssetCard({
  position: p,
  totalPortfolioValue,
}: MobileAssetCardProps) {
  const { hideBalances, compactView } = usePreferences()

  const pnlPercent    = p.pnl_percent ?? 0
  const isPositive    = pnlPercent >= 0
  const change24h     = p.change_percent_24h ?? 0
  const is24hPositive = change24h >= 0

  const cfg = TYPE_CONFIG[p.tipo] ?? { color: "oklch(0.60 0.016 230)", label: p.tipo }

  // Portfolio weight (0–100)
  const weight =
    totalPortfolioValue > 0 && p.valor_actual !== null
      ? Math.min(100, (p.valor_actual / totalPortfolioValue) * 100)
      : 0

  const displayTicker =
    p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
      : p.ticker.split(".")[0]

  const displayName =
    p.nombre
      ?.replace(/\b(fund|index|world|acc|eur|hedged|p-acc)\b/gi, "")
      .trim() || displayTicker

  // Compact mode
  if (compactView) {
    return (
      <Link href={`/activo/${p.activo_id}`} className="block">
        <div
          className="flex items-center gap-3 px-4 py-2.5 transition-colors active:opacity-70"
          style={{ borderBottom: "1px solid oklch(0.195 0.018 235 / 0.4)" }}
        >
          {/* Avatar dot */}
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-[10px]"
            style={{
              background: `${cfg.color.replace(")", " / 0.12)")}`,
              color: cfg.color,
              border: `1px solid ${cfg.color.replace(")", " / 0.20)")}`,
            }}
          >
            {displayTicker.slice(0, 2)}
          </div>

          <span
            className="text-[13px] font-semibold flex-1 truncate"
            style={{ color: "var(--foreground)" }}
          >
            {displayTicker}
          </span>

          <div className="flex flex-col items-end">
            <span className="text-[13px] font-bold font-tabular" style={{ color: "var(--foreground)" }}>
              {hideBalances ? "••••" : formatCurrency(p.valor_actual ?? 0)}
            </span>
            <span
              className="text-[10px] font-semibold font-tabular"
              style={{ color: is24hPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)" }}
            >
              {hideBalances ? "•••" : formatPercent(change24h)}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/activo/${p.activo_id}`} className="block">
      <motion.div
        whileTap={{ scale: 0.96, opacity: 0.8 }}
        className="px-4 py-3.5 transition-colors relative"
        style={{ borderBottom: "1px solid oklch(0.68 0.17 192 / 0.06)" }}
      >
        <div className="flex items-center gap-3.5">
          {/* Asset avatar — colored by type */}
          <div
            className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-[13px]"
            style={{
              background: `color-mix(in oklch, ${cfg.color} 14%, transparent)`,
              color: cfg.color,
              border: `1.5px solid color-mix(in oklch, ${cfg.color} 22%, transparent)`,
            }}
          >
            {displayTicker.slice(0, 2)}
          </div>

          {/* Name + type badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[15px] font-bold tracking-tight truncate"
                style={{ color: "var(--foreground)" }}
              >
                {displayTicker}
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{
                  color: cfg.color,
                  background: `color-mix(in oklch, ${cfg.color} 10%, transparent)`,
                }}
              >
                {cfg.label}
              </span>
            </div>

            {/* Weight bar */}
            <div className="flex items-center gap-2 mt-1">
              <div
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: "var(--muted)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${weight}%`,
                    background: `linear-gradient(90deg, ${cfg.color}, color-mix(in oklch, ${cfg.color} 70%, oklch(0.65 0.19 155)))`,
                  }}
                />
              </div>
              <span
                className="text-[9px] font-semibold flex-shrink-0"
                style={{ color: "var(--muted-foreground)", opacity: 0.55 }}
              >
                {weight.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Value + 24h change */}
          <div className="flex flex-col items-end flex-shrink-0 gap-1">
            <span
              className="text-[15px] font-bold font-tabular leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {hideBalances
                ? "••••"
                : p.valor_actual !== null
                ? formatCurrency(p.valor_actual)
                : "—"}
            </span>

            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg"
              style={{
                background: is24hPositive
                  ? "oklch(0.65 0.19 155 / 0.10)"
                  : "oklch(0.62 0.20 20 / 0.10)",
              }}
            >
              <span
                className="text-[11px] font-bold font-tabular"
                style={{
                  color: is24hPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)",
                }}
              >
                {hideBalances ? "•••" : (
                  <>
                    {p.change_amount_24h !== undefined && p.change_amount_24h !== null && p.change_amount_24h !== 0
                      ? `${p.change_amount_24h > 0 ? "+" : ""}${formatCurrency(p.change_amount_24h)} `
                      : ""}
                    {formatPercent(change24h)}
                  </>
                )}
              </span>
            </div>
          </div>

          <ChevronRight
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "var(--muted-foreground)", opacity: 0.25 }}
          />
        </div>
      </motion.div>
    </Link>
  )
})
