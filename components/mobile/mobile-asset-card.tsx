"use client"

import Link from "next/link"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Sparkline } from "@/components/asset/sparkline"

interface MobileAssetCardProps {
  position: EnrichedPosition
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  ETF: { bg: "bg-blue-500/10", text: "text-blue-400" },
  "Fondo Indexado": { bg: "bg-purple-500/10", text: "text-purple-400" },
  "Fondo Monetario": { bg: "bg-cyan-500/10", text: "text-cyan-400" },
  Acción: { bg: "bg-amber-500/10", text: "text-amber-400" },
  Crypto: { bg: "bg-orange-500/10", text: "text-orange-400" },
}

export function MobileAssetCard({ position: p }: MobileAssetCardProps) {
  const pnl = p.pnl ?? 0
  const pnlPercent = p.pnl_percent ?? 0
  const isPositive = pnl >= 0
  const pnlColor = isPositive ? "text-emerald-400" : "text-rose-400"
  const pnlBg = isPositive ? "bg-emerald-500/8" : "bg-rose-500/8"
  const PnlIcon = pnl > 0 ? TrendingUp : pnl < 0 ? TrendingDown : Minus

  const typeStyle = TYPE_COLORS[p.tipo] ?? {
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
  }

  const displayTicker =
    p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
      : p.ticker.split(".")[0]

  const hasSparkline = p.sparkline && p.sparkline.length > 1
  const sparkColor = hasSparkline
    ? p.sparkline[p.sparkline.length - 1] >= p.sparkline[0]
      ? "#34d399"
      : "#fb7185"
    : "#71717a"

  return (
    <Link
      href={`/activo/${p.activo_id}`}
      className="block active:scale-[0.98] transition-transform duration-150"
    >
      <div className="flex items-center gap-4 px-5 py-4 bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/30">
        {/* Left: Icon circle */}
        <div
          className={`h-11 w-11 rounded-xl ${typeStyle.bg} flex items-center justify-center flex-shrink-0`}
        >
          <span className={`text-sm font-bold ${typeStyle.text}`}>
            {displayTicker.slice(0, 2)}
          </span>
        </div>

        {/* Center: Name + Sparkline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-white truncate">
              {displayTicker}
            </span>
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}
            >
              {p.tipo === "Fondo Indexado"
                ? "Fondo"
                : p.tipo === "Fondo Monetario"
                  ? "Monet."
                  : p.tipo}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-zinc-500 truncate max-w-[120px]">
              {p.nombre || "—"}
            </span>
            {hasSparkline && (
              <div className="h-4 w-12 opacity-60">
                <Sparkline data={p.sparkline} color={sparkColor} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Value + P&L */}
        <div className="flex flex-col items-end flex-shrink-0">
          <span className="text-[15px] font-bold font-tabular text-white">
            {p.valor_actual !== null
              ? formatCurrency(p.valor_actual, "EUR")
              : "—"}
          </span>
          <div
            className={`flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md ${pnlBg}`}
          >
            <PnlIcon className={`h-3 w-3 ${pnlColor}`} />
            <span className={`text-xs font-semibold font-tabular ${pnlColor}`}>
              {formatPercent(pnlPercent)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
