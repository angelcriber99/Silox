"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import Link from "next/link"
import { Layers, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"

interface CategoryDrilldownModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryName: string
  originalCategoryName: string
  positions: EnrichedPosition[]
  groupBy: "tipo" | "estrategia"
  hideBalances: boolean
}

export function CategoryDrilldownModal({
  open,
  onOpenChange,
  categoryName,
  originalCategoryName,
  positions,
  groupBy,
  hideBalances
}: CategoryDrilldownModalProps) {

  const categoryPositions = positions.filter(p => {
    const key = groupBy === "tipo" ? p.tipo : p.estrategia
    return key === originalCategoryName && (p.valor_actual !== null || p.coste_total > 0)
  }).sort((a, b) => ((b.valor_actual ?? b.coste_total) - (a.valor_actual ?? a.coste_total)))

  const totalValue = categoryPositions.reduce((sum, p) => sum + (p.valor_actual ?? p.coste_total), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Layers className="w-5 h-5 text-purple-400" />
            {categoryName}
          </DialogTitle>
          <div className="mt-2 text-sm text-muted-foreground flex items-baseline gap-2">
            <span className="font-semibold text-foreground text-2xl tracking-tight">
              {hideBalances ? "****" : formatCurrency(totalValue)}
            </span>
            <span>Total en activos</span>
          </div>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
          {categoryPositions.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No hay activos con valor en esta categoría.
            </div>
          ) : (
            categoryPositions.map(p => {
              const value = p.valor_actual ?? p.coste_total
              const isPositive = (p.change_percent_24h ?? 0) >= 0
              
              return (
                <Link
                  key={p.activo_id}
                  href={`/activo/${p.activo_id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground flex items-center gap-2">
                      {p.ticker}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-1">{p.nombre}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="font-medium text-foreground">
                        {hideBalances ? "****" : formatCurrency(value)}
                      </span>
                      {p.change_percent_24h !== null && p.change_percent_24h !== undefined && (
                        <div className={`text-[10px] font-medium flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{formatPercent(p.change_percent_24h).replace('+', '')} hoy
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
