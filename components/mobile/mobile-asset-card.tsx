"use client"

import React from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { AssetLogo } from "@/components/ui/asset-logo"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useQuickAdd } from "@/lib/stores/use-quick-add"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
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
  const { openWithAsset } = useQuickAdd()
  const visibleChange = performanceMode === "session"
    ? position.change_percent_24h ?? 0
    : position.daily_change_percent_24h ?? 0
  const dayAmount = (position.displayDailyPnL?.amount ?? null) ?? 0
  const totalChange = position.pnl_percent ?? 0
  const nativePrice = position.precio_actual_nativo ?? position.precio_actual
  const nativeCurrency = position.original_currency || position.moneda
  const positionValue = (position.displayValue?.amount ?? null) ?? position.displayCost.amount
  const weight = totalPortfolioValue > 0 ? (positionValue / totalPortfolioValue) * 100 : 0
  const changePositive = visibleChange >= 0

  const addMovement = () => {
    hapticFeedback.medium()
    openWithAsset(position)
  }

  return (
    <article className="relative border-b border-border/50 last:border-b-0">
      <div className="flex min-h-[82px] items-center gap-2 px-4 py-3 transition-colors active:bg-muted/40">
        <Link
          href={`/activo/${position.activo_id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
          aria-label={`Abrir ${position.ticker}`}
        >
          <div className="relative shrink-0">
            <AssetLogo ticker={position.ticker} name={position.nombre} type={position.tipo} size={42} />
            {position.price_is_stale && (
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-amber-400"
                aria-label="Cotización pendiente de actualizar"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold leading-tight">{position.ticker.split(".")[0]}</span>
              {position.price_is_stale && (
                <span className="shrink-0 rounded bg-amber-400/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-400">
                  Retrasado
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{position.nombre || position.tipo}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">
              <span>{nativePrice === null ? "Sin cotización" : formatCurrency(nativePrice, nativeCurrency)}</span>
              <span aria-hidden="true">·</span>
              <span>{weight.toFixed(1)}% cartera</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">
              {hideBalances ? "••••" : formatDisplay(positionValue)}
            </p>
            <div className={`mt-1 flex items-center justify-end gap-1.5 text-xs font-semibold tabular-nums ${changePositive ? "text-emerald-500" : "text-rose-500"}`}>
              <span>{hideBalances ? "••" : formatPercent(visibleChange)}</span>
              <span className="text-[9px] font-medium uppercase tracking-wide opacity-70">
                {performanceMode === "session" ? "sesión" : "día"}
              </span>
            </div>
            <p className="mt-0.5 text-[9px] tabular-nums text-muted-foreground">
              {hideBalances ? "••" : `${dayAmount >= 0 ? "+" : ""}${formatDisplay(dayAmount)} hoy`}
              <span aria-hidden="true"> · </span>
              <span className={totalChange >= 0 ? "text-emerald-500/75" : "text-rose-500/75"}>
                {hideBalances ? "••" : `${formatPercent(totalChange)} total`}
              </span>
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={addMovement}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors active:bg-muted active:text-foreground"
          aria-label={`Añadir movimiento en ${position.ticker}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
})
