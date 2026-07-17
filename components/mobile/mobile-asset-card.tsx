"use client"

import React from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { AssetLogo } from "@/components/ui/asset-logo"
import type { EnrichedPosition } from "@/lib/types"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useQuickAdd } from "@/lib/stores/use-quick-add"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { hapticFeedback } from "@/lib/utils/haptics"

interface MobileAssetCardProps {
  position: EnrichedPosition
  totalPortfolioValue: number
}

export const MobileAssetCard = React.memo(function MobileAssetCard({
  position,
  totalPortfolioValue,
}: MobileAssetCardProps) {
  const { hideBalances } = usePreferences()
  const { openWithAsset } = useQuickAdd()
  const dailyChange = position.daily_change_percent_24h ?? 0
  const isPositive = dailyChange >= 0
  const nativePrice = position.precio_actual_nativo ?? position.precio_actual
  const nativeCurrency = position.original_currency || position.moneda
  const weight = totalPortfolioValue > 0 && position.valor_actual !== null
    ? (position.valor_actual / totalPortfolioValue) * 100
    : 0

  const addMovement = () => {
    hapticFeedback.medium()
    openWithAsset(position)
  }

  return (
    <div className="group relative border-b border-border/50 last:border-b-0">
      <div className="flex min-h-[76px] items-center gap-3 px-4 py-3 active:bg-muted/40">
        <Link
          href={`/activo/${position.activo_id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
          aria-label={`Abrir ${position.ticker}`}
        >
          <div className="relative shrink-0">
            <AssetLogo
              ticker={position.ticker}
              name={position.nombre}
              type={position.tipo}
              size={42}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${position.price_is_stale ? "bg-amber-400" : "bg-emerald-400"}`}
              title={position.price_is_stale ? "Cotización pendiente de actualizar" : "Cotización actualizada"}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[15px] font-semibold text-foreground">
                {position.ticker.split(".")[0]}
              </span>
              <span className={`text-xs font-semibold tabular-nums ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                {formatPercent(dailyChange)}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {position.nombre || position.tipo}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/80">
              {nativePrice === null ? "Sin cotización" : formatCurrency(nativePrice, nativeCurrency)}
              <span className="px-1.5">·</span>{weight.toFixed(1)}%
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {hideBalances ? "••••" : formatCurrency(position.valor_actual ?? position.coste_total_eur)}
            </p>
            <p className={`mt-1 text-xs font-medium tabular-nums ${(position.change_amount_24h ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {hideBalances ? "•••" : `${(position.change_amount_24h ?? 0) >= 0 ? "+" : ""}${formatCurrency(position.change_amount_24h ?? 0)}`}
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={addMovement}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors active:bg-muted"
          aria-label={`Añadir movimiento en ${position.ticker}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
})
