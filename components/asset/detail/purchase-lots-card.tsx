"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Layers3, TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent, formatUnits } from "@/lib/utils/formatters"
import { calculateOpenPurchaseLots } from "@/lib/utils/open-cost-basis"
import type { RawTransaction } from "./use-asset-calculations"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"

interface PurchaseLotsCardProps {
  position: EnrichedPosition
  transactions: RawTransaction[]
}

const INITIAL_VISIBLE_LOTS = 3
const EPSILON = 0.00000001

function currentPriceInTransactionCurrency(position: EnrichedPosition): number | null {
  if (position.moneda === "EUR") return position.precio_actual
  if (position.original_currency === position.moneda) return position.precio_actual_nativo
  return position.precio_actual_nativo ?? position.precio_actual
}

export function PurchaseLotsCard({ position, transactions }: PurchaseLotsCardProps) {
  const [showAll, setShowAll] = useState(false)
  const { format: formatDisplay } = useDisplayCurrency()
  const currentPrice = currentPriceInTransactionCurrency(position)
  const lots = useMemo(
    () => calculateOpenPurchaseLots(transactions).slice().reverse(),
    [transactions],
  )
  const visibleLots = showAll ? lots : lots.slice(0, INITIAL_VISIBLE_LOTS)
  const hiddenCount = Math.max(0, lots.length - INITIAL_VISIBLE_LOTS)
  const conversionRate = (position.precio_actual && position.precio_actual_nativo && position.precio_actual_nativo > 0)
    ? position.precio_actual / position.precio_actual_nativo
    : 1

  return (
    <Card className="mb-10 border-border bg-card backdrop-blur-sm animate-fade-in">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <Layers3 className="h-5 w-5 text-blue-400" />
              Rendimiento por compra
            </CardTitle>
            <CardDescription className="mt-1">
              Lotes que siguen abiertos después de aplicar FIFO. Las ventas consumen primero las compras más antiguas.
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 border-blue-500/20 bg-blue-500/10 text-blue-300">
            {lots.length} {lots.length === 1 ? "lote" : "lotes"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {lots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
            <p className="font-medium text-foreground">No hay compras abiertas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Los lotes anteriores han sido consumidos por ventas FIFO o todavía no hay compras completadas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleLots.map((lot) => {
              const currentValue = currentPrice === null ? null : lot.remainingQuantity * currentPrice
              const referenceValue = lot.remainingQuantity * lot.performanceUnitCost
              const referenceValueEur = lot.remainingQuantity * lot.performanceUnitCostEur
              const pnl = currentValue === null ? null : currentValue - referenceValue
              
              const currentValueEur = currentValue !== null ? currentValue * conversionRate : null
              const pnlEur = currentValueEur !== null ? currentValueEur - referenceValueEur : null
              const pnlPercent = pnlEur === null || referenceValueEur <= 0 ? null : (pnlEur / referenceValueEur) * 100
              const isPositive = (pnlEur ?? 0) >= 0
              const isPartial = lot.remainingQuantity < lot.originalQuantity - EPSILON
              const isReward = lot.investedUnitCost === 0

              return (
                <div
                  key={lot.transactionId ?? `${lot.date}-${lot.createdAt}-${lot.originalQuantity}`}
                  className="grid gap-4 rounded-xl border border-border/70 bg-background/35 p-4 md:grid-cols-[1.2fr_1fr_1fr_1.15fr] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {new Date(lot.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      {isPartial && <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-300">Parcial</Badge>}
                      {isReward && <Badge variant="outline" className="border-violet-500/20 bg-violet-500/10 text-violet-300">Recompensa</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatUnits(lot.remainingQuantity)} abiertas
                      {isPartial ? ` de ${formatUnits(lot.originalQuantity)}` : ""}
                    </p>
                  </div>

                  <div className="flex justify-between gap-3 md:block">
                    <span className="text-xs text-muted-foreground">Precio de compra</span>
                    <p className="font-medium tabular-nums text-foreground">
                      {formatCurrency(lot.purchasePrice, position.moneda, position.tipo === "Fondo Indexado" ? 4 : 2)}
                    </p>
                    {lot.commission > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Coste con comisión: {formatCurrency(lot.performanceUnitCost, position.moneda, position.tipo === "Fondo Indexado" ? 4 : 2)}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between gap-3 md:block">
                    <span className="text-xs text-muted-foreground">Valor actual</span>
                    <p className="font-medium tabular-nums text-foreground">
                      {currentValueEur === null ? "—" : formatDisplay(currentValueEur)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <div className="md:text-right">
                      <span className="text-xs text-muted-foreground">Rendimiento</span>
                      {pnl === null || pnlPercent === null ? (
                        <p className="font-medium text-muted-foreground">Sin cotización</p>
                      ) : (
                        <>
                          <p className={`font-bold tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                            {isPositive ? "+" : ""}{formatDisplay(pnlEur ?? pnl)}
                          </p>
                          <p className={`flex items-center gap-1 text-xs font-semibold tabular-nums md:justify-end ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            {formatPercent(pnlPercent)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {hiddenCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                {showAll ? "Mostrar menos" : `Ver ${hiddenCount} lotes más`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
