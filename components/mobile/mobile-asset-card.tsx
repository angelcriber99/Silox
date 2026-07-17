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
  const dayAmount = position.change_amount_24h ?? 0
  const totalChange = position.pnl_percent ?? 0
  const dayPositive = dailyChange >= 0
  const totalPositive = totalChange >= 0
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
    <article className="group relative border-b border-border/50 last:border-b-0">
      <div className="flex min-h-[82px] items-center gap-2 px-4 py-3 transition-colors active:bg-muted/40">
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
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${position.price_is_stale ? "bg-amber-400" : "bg-emerald-400"}`}
              title={position.price_is_stale ? "Cotización pendiente de actualizar" : "Cotización actualizada"}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold leading-tight text-foreground">
                {position.ticker.split(".")[0]}
              </span>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${dayPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                {formatPercent(dailyChange)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {position.nombre || position.tipo}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">
              <span>{nativePrice === null ? "Sin cotización" : formatCurrency(nativePrice, nativeCurrency)}</span>
              <span>·</span>
              <span>{weight.toFixed(1)}%</span>
              <span>·</span>
              <span className={totalPositive ? "text-emerald-500" : "text-rose-500"}>
                {formatPercent(totalChange)} total
              </span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {hideBalances ? "••••" : formatCurrency(position.valor_actual ?? position.coste_total_eur)}
            </p>
            <p className={`mt-1 text-xs font-medium tabular-nums ${dayAmount >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {hideBalances ? "•••" : `${dayAmount >= 0 ? "+" : ""}${formatCurrency(dayAmount)}`}
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={addMovement}
          className="touch-target shrink-0 rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
          aria-label={`Añadir movimiento en ${position.ticker}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
})
