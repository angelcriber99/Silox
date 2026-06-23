"use client"

import Link from "next/link"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { playSound } from "@/lib/utils/sounds"

interface MobileAssetCardProps {
  position: EnrichedPosition
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  ETF: { bg: "bg-blue-500/10", text: "text-blue-500" },
  "Fondo Indexado": { bg: "bg-purple-500/10", text: "text-purple-500" },
  "Fondo Monetario": { bg: "bg-cyan-500/10", text: "text-cyan-500" },
  Acción: { bg: "bg-amber-500/10", text: "text-amber-500" },
  Crypto: { bg: "bg-orange-500/10", text: "text-orange-500" },
}

export function MobileAssetCard({ position: p }: MobileAssetCardProps) {
  const { soundEffects, hideBalances, compactView } = usePreferences()
  
  const pnlPercent = p.pnl_percent ?? 0
  const isPositive = pnlPercent >= 0
  const pnlColor = isPositive ? "text-emerald-500" : "text-rose-500"
  const pnlBg = isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"

  const change24h = p.change_percent_24h ?? 0
  const is24hPositive = change24h >= 0
  const change24hColor = is24hPositive ? "text-emerald-500" : "text-rose-500"

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
      onClick={() => { if (soundEffects) playSound('click') }}
      className="block active:bg-muted/30 transition-colors"
    >
      <div className={`flex items-center gap-3 bg-card/10 hover:bg-muted/10 ${compactView ? 'px-4 py-2' : 'px-5 py-3.5'}`}>
        
        {/* Left: Icon circle */}
        {!compactView && (
          <div className={`h-9 w-9 rounded-[10px] ${typeStyle.bg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-[11px] font-bold ${typeStyle.text}`}>
              {displayTicker.slice(0, 2)}
            </span>
          </div>
        )}

        {/* Center: Ticker + Name */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className={`${compactView ? 'text-sm' : 'text-[13px]'} font-semibold text-foreground truncate tracking-tight`}>
              {displayTicker}
            </span>
            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${typeStyle.bg} ${typeStyle.text}`}>
              {p.tipo === "Fondo Indexado"
                ? "Fondo"
                : p.tipo === "Fondo Monetario"
                  ? "Monet."
                  : p.tipo}
            </span>
          </div>
          {!compactView && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {p.nombre || "—"}
            </p>
          )}
        </div>

        {/* Right: Value + P&L */}
        <div className="flex flex-col items-end flex-shrink-0 justify-center">
          <span className={`${compactView ? 'text-sm' : 'text-[13px]'} font-semibold font-tabular text-foreground`}>
            {hideBalances ? "****" : (p.valor_actual !== null
              ? formatCurrency(p.valor_actual, "EUR")
              : "—")}
          </span>
          <div className={`flex items-center gap-1.5 ${compactView ? '' : 'mt-0.5'}`}>
            <span className={`text-[10px] font-medium font-tabular ${change24hColor}`}>
              {is24hPositive ? "+" : ""}{hideBalances ? "**.*%" : formatPercent(change24h)}
            </span>
            <div className={`flex items-center justify-center px-1.5 py-0.5 rounded ${pnlBg}`}>
              <span className={`text-[9px] font-bold font-tabular ${pnlColor}`}>
                {isPositive ? "+" : ""}{hideBalances ? "**.*%" : formatPercent(pnlPercent)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
