"use client"

import Link from "next/link"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { playSound } from "@/lib/utils/sounds"

interface MobileAssetCardProps {
  position: EnrichedPosition
}

const TYPE_CONFIG: Record<string, { bg: string; text: string; emoji: string }> = {
  ETF: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-600 dark:text-blue-400", emoji: "🌐" },
  "Fondo Indexado": { bg: "bg-purple-500/10 border-purple-500/20", text: "text-purple-600 dark:text-purple-400", emoji: "📦" },
  "Fondo Monetario": { bg: "bg-cyan-500/10 border-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400", emoji: "🏦" },
  Acción: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-600 dark:text-amber-400", emoji: "🏢" },
  Crypto: { bg: "bg-orange-500/10 border-orange-500/20", text: "text-orange-600 dark:text-orange-400", emoji: "🪙" },
}

export function MobileAssetCard({ position: p }: MobileAssetCardProps) {
  const { soundEffects, hideBalances } = usePreferences()
  
  const pnlPercent = p.pnl_percent ?? 0
  const isPositive = pnlPercent >= 0

  const typeConfig = TYPE_CONFIG[p.tipo] ?? {
    bg: "bg-zinc-500/10 border-zinc-500/20",
    text: "text-muted-foreground",
    emoji: "📄"
  }

  const displayTicker =
    p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
      : p.ticker.split(".")[0]

  return (
    <Link
      href={`/activo/${p.activo_id}`}
      onClick={() => { if (soundEffects) playSound('pop') }}
      className="block active:scale-[0.96] transition-transform duration-150"
    >
      <div className={`flex items-center gap-4 bg-card hover:bg-muted/50 border-2 rounded-[28px] p-4 shadow-sm transition-colors ${typeConfig.bg}`}>
        
        {/* Left: Emoji Circle */}
        <div className="h-14 w-14 rounded-2xl bg-background shadow-sm flex items-center justify-center flex-shrink-0 text-2xl">
          {typeConfig.emoji}
        </div>

        {/* Center: Ticker + Name */}
        <div className="flex-1 min-w-0">
          <p className="text-lg font-black text-foreground truncate leading-tight">
            {p.nombre || displayTicker}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-black uppercase tracking-wider ${typeConfig.text}`}>
              {p.tipo}
            </span>
          </div>
        </div>

        {/* Right: Value + P&L */}
        <div className="flex flex-col items-end flex-shrink-0">
          <span className="text-xl font-black font-tabular text-foreground tracking-tight">
            {hideBalances ? "****" : (p.valor_actual !== null
              ? formatCurrency(p.valor_actual, "EUR")
              : "—")}
          </span>
          <div className={`mt-1 flex items-center justify-center px-2 py-1 rounded-xl font-bold font-tabular text-xs ${
            isPositive ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
          }`}>
            {isPositive ? "+" : ""}{hideBalances ? "**.*%" : formatPercent(pnlPercent)}
          </div>
        </div>
      </div>
    </Link>
  )
}
