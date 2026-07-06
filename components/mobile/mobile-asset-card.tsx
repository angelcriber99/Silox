"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { LineChart, Line, ResponsiveContainer } from "recharts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MobileAssetCardProps {
  position: EnrichedPosition
  totalPortfolioValue: number
}

const TYPE_CONFIG: Record<string, { bg: string; text: string; accent: string; label: string }> = {
  ETF:              { bg: "bg-blue-500/15",    text: "text-blue-400",    accent: "#3b82f6", label: "ETF"      },
  "Fondo Indexado": { bg: "bg-violet-500/15",  text: "text-violet-400",  accent: "#8b5cf6", label: "Fondo"    },
  "Fondo Monetario":{ bg: "bg-cyan-500/15",    text: "text-cyan-400",    accent: "#06b6d4", label: "Monetario"},
  Acción:           { bg: "bg-amber-500/15",   text: "text-amber-400",   accent: "#f59e0b", label: "Acción"   },
  Crypto:           { bg: "bg-orange-500/15",  text: "text-orange-400",  accent: "#f97316", label: "Crypto"   },
  Liquidez:         { bg: "bg-zinc-500/15",    text: "text-zinc-400",    accent: "#71717a", label: "Liquidez" },
}

export const MobileAssetCard = React.memo(function MobileAssetCard({
  position: p,
  totalPortfolioValue,
}: MobileAssetCardProps) {
  const { hideBalances, compactView } = usePreferences()

  const pnlPercent   = p.pnl_percent ?? 0
  const isPositive   = pnlPercent >= 0
  const change24h    = p.change_percent_24h ?? 0
  const is24hPositive = change24h >= 0

  const cfg = TYPE_CONFIG[p.tipo] ?? { bg: "bg-zinc-500/15", text: "text-zinc-400", accent: "#71717a", label: p.tipo }

  const weight = totalPortfolioValue > 0 && p.valor_actual !== null
    ? Math.min(100, (p.valor_actual / totalPortfolioValue) * 100)
    : 0

  const displayTicker =
    p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
      : p.ticker.split(".")[0]

  const displayName = p.nombre?.replace(/\b(fund|index|world|acc|eur|hedged|p-acc)\b/gi, "").trim() || displayTicker

  // Sparkline data
  const sparkData = useMemo(() => {
    if (!p.sparkline || p.sparkline.length < 2) return null
    return p.sparkline.map((v, i) => ({ i, v }))
  }, [p.sparkline])

  const sparkColor = change24h >= 0 ? "#10b981" : "#f43f5e"

  // Trend icon
  const TrendIcon = change24h > 0.01 ? TrendingUp : change24h < -0.01 ? TrendingDown : Minus
  const trendColor = change24h > 0.01 ? "text-emerald-400" : change24h < -0.01 ? "text-rose-400" : "text-zinc-500"

  if (compactView) {
    return (
      <Link
        href={`/activo/${p.activo_id}`}
        className="block active:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className={`h-7 w-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-[10px] font-bold ${cfg.text}`}>{displayTicker.slice(0, 2)}</span>
          </div>
          <span className="text-[13px] font-semibold text-foreground flex-1 truncate">{displayTicker}</span>
          <div className="flex flex-col items-end">
            <span className="text-[13px] font-semibold font-tabular text-foreground">
              {hideBalances ? "••••" : formatCurrency(p.valor_actual ?? 0)}
            </span>
            <span className={`text-[10px] font-medium font-tabular ${change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {hideBalances ? "•••" : formatPercent(change24h)}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/activo/${p.activo_id}`}
      className="block active:bg-muted/20 transition-colors"
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">

          {/* Premium Circular Avatar */}
          <div className={`h-11 w-11 rounded-full ${cfg.bg} border border-white/5 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
            <span className={`text-[13px] font-bold ${cfg.text}`}>{displayTicker.slice(0, 2)}</span>
          </div>

          {/* Middle */}
          <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
            <span className="text-[16px] font-bold text-foreground tracking-tight truncate leading-tight">
              {displayTicker}
            </span>
            <p className="text-[11px] text-muted-foreground/60 truncate leading-none mt-0.5">
              {displayName}
            </p>
          </div>

          {/* Right: Value + Daily Change */}
          <div className="flex flex-col items-end flex-shrink-0 justify-center py-1">
            {/* Current value */}
            <span className="text-[16px] font-bold font-tabular text-foreground leading-tight">
              {hideBalances ? "••••" : (p.valor_actual !== null ? formatCurrency(p.valor_actual) : "—")}
            </span>

            {/* Daily Change */}
            <div className={`flex items-center mt-0.5 ${trendColor}`}>
              <span className="text-[12px] font-medium font-tabular">
                {hideBalances ? "•••" : (
                  <>
                    {p.change_amount_24h !== undefined && p.change_amount_24h !== null && p.change_amount_24h !== 0
                      ? `${p.change_amount_24h > 0 ? '+' : ''}${formatCurrency(p.change_amount_24h)}`
                      : ""}
                    <span className="ml-1 opacity-80">{formatPercent(change24h)}</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
})
