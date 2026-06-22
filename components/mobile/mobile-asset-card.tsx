"use client"

import Link from "next/link"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import { playSound } from "@/lib/utils/sounds"

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
  const { soundEffects, hideBalances, compactView } = usePreferences()
  const pnl = p.pnl ?? 0
  const pnlPercent = p.pnl_percent ?? 0
  const isPositive = pnl >= 0
  const pnlColor = isPositive ? "text-emerald-400" : "text-rose-400"
  const pnlBg = isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"

  const change24h = p.change_percent_24h ?? 0
  const is24hPositive = change24h >= 0
  const change24hColor = is24hPositive ? "text-emerald-400" : "text-rose-400"

  const typeStyle = TYPE_COLORS[p.tipo] ?? {
    bg: "bg-zinc-500/10",
    text: "text-muted-foreground",
  }

  const displayTicker =
    p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
      : p.ticker.split(".")[0]

  return (
    <Link
      href={`/activo/${p.activo_id}`}
      onClick={() => { if (soundEffects) playSound('pop') }}
      className="block active:scale-[0.98] transition-transform duration-150"
    >
      <div className={`flex items-center gap-4 bg-card/40 hover:bg-muted/50 backdrop-blur-sm transition-colors border-b border-border/30 ${compactView ? 'px-4 py-2' : 'px-5 py-4'}`}>
        {/* Left: Icon circle (hidden in compact mode) */}
        {!compactView && (
          <div
            className={`h-11 w-11 rounded-xl ${typeStyle.bg} flex items-center justify-center flex-shrink-0 shadow-sm`}
          >
            <span className={`text-sm font-bold ${typeStyle.text}`}>
              {displayTicker.slice(0, 2)}
            </span>
          </div>
        )}

        {/* Center: Ticker + Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`${compactView ? 'text-sm' : 'text-[15px]'} font-semibold text-foreground truncate`}>
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
          {!compactView && (
            <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
              {p.nombre || "—"}
            </p>
          )}
        </div>

        {/* Right: Value + P&L */}
        <div className="flex flex-col items-end flex-shrink-0">
          <span className={`${compactView ? 'text-sm' : 'text-[15px]'} font-bold font-tabular text-foreground`}>
            {hideBalances ? "****" : (p.valor_actual !== null
              ? formatCurrency(p.valor_actual, "EUR")
              : "—")}
          </span>
          <div className={`flex items-center gap-1.5 ${compactView ? '' : 'mt-0.5'}`}>
            <span className={`text-[11px] font-medium font-tabular ${change24hColor}`}>
              {hideBalances ? "**.*%" : formatPercent(change24h)}
            </span>
            <div
              className={`flex items-center justify-center px-1.5 py-0.5 rounded-md ${pnlBg}`}
            >
              <span className={`text-[10px] font-bold font-tabular ${pnlColor}`}>
                {hideBalances ? "**.*%" : formatPercent(pnlPercent)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
