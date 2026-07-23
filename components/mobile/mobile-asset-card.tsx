"use client"

import React from "react"
import Link from "next/link"

import { AssetLogo } from "@/components/ui/asset-logo"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { EnrichedPosition } from "@/lib/types"
import { formatPercent } from "@/lib/utils/formatters"
import { hapticFeedback } from "@/lib/utils/haptics"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"

interface MobileAssetCardProps {
  position: EnrichedPosition
  totalPortfolioValue: number
  performanceMode: "session" | "day"
}

export const MobileAssetCard = React.memo(function MobileAssetCard({
  position,
  totalPortfolioValue,
  performanceMode,
}: MobileAssetCardProps) {
  const { hideBalances } = usePreferences()
  const { format: formatDisplay } = useDisplayCurrency()
  
  const visibleChange = performanceMode === "session"
    ? position.change_percent_24h ?? 0
    : position.daily_change_percent_24h ?? 0
  const positionValue = (position.displayValue?.amount ?? null) ?? position.displayCost.amount
  const changePositive = visibleChange >= 0

  return (
    <article>
      <Link
        href={`/activo/${position.activo_id}`}
        onClick={() => hapticFeedback.light()}
        className="flex items-center gap-4 py-3.5 transition-colors active:bg-zinc-200 dark:active:bg-zinc-800/50 rounded-2xl px-2 -mx-2"
        aria-label={`Abrir ${position.ticker}`}
      >
        {/* LOGO */}
        <div className="relative shrink-0">
          <AssetLogo ticker={position.ticker} name={position.nombre} type={position.tipo} size={48} />
          {position.price_is_stale && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[3px] border-[#F5F5F7] dark:border-zinc-950 bg-amber-400"
              aria-label="Cotización pendiente de actualizar"
            />
          )}
        </div>

        {/* MIDDLE (TITLE + SUBTITLE) */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold leading-tight text-zinc-900 dark:text-white">
            {position.ticker.split(".")[0]}
          </p>
          <p className="mt-1.5 truncate text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
            {position.nombre || position.tipo}
          </p>
        </div>

        {/* RIGHT (VALUE + CHANGE) */}
        <div className="shrink-0 text-right">
          <p className="text-[16px] font-bold tabular-nums text-zinc-900 dark:text-white">
            {hideBalances ? "••••" : formatDisplay(positionValue)}
          </p>
          <p className={`mt-1.5 text-[13px] font-medium tabular-nums ${changePositive ? "text-emerald-500" : "text-rose-500"}`}>
            {hideBalances ? "••" : `${changePositive ? "+" : ""}${formatPercent(visibleChange)}`}
          </p>
        </div>
      </Link>
    </article>
  )
})
