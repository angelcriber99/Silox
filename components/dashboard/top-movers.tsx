"use client"

import { useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EnrichedPosition } from '@/lib/types'
import { formatPercent, formatPnl } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown } from "lucide-react"

export function TopMovers({ positions }: { positions: EnrichedPosition[] }) {
  const [sortBy, setSortBy] = useState<"percent" | "amount">("amount")

  const validPositions = positions.filter(p => {
    if (sortBy === "percent") {
      return typeof p.change_percent_24h === 'number' && p.change_percent_24h !== 0
    } else {
      return typeof p.change_amount_24h === 'number' && p.change_amount_24h !== 0 && p.unidades > 0
    }
  })
  
  const sorted = [...validPositions].sort((a, b) => {
    if (sortBy === "percent") {
      return (b.change_percent_24h || 0) - (a.change_percent_24h || 0)
    } else {
      return (b.change_amount_24h || 0) - (a.change_amount_24h || 0)
    }
  })
  
  // Best must be positive
  const best = sorted.filter(p => sortBy === "percent" ? p.change_percent_24h! > 0 : p.change_amount_24h! > 0).slice(0, 3)
  
  // Worst must be negative
  const worst = sorted.slice().reverse().filter(p => sortBy === "percent" ? p.change_percent_24h! < 0 : p.change_amount_24h! < 0).slice(0, 3)

  const getDisplayName = (p: EnrichedPosition) => {
    if (p.nombre?.toUpperCase().includes("MSCI")) return "MSCI"
    if (p.ticker.startsWith("0P")) return p.nombre || p.ticker.split('.')[0]
    return p.ticker.split('.')[0]
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="p-4 pb-2 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">🔥 Top Movimientos (24h)</CardTitle>
        <div className="flex bg-muted/50 rounded-md p-0.5">
          <button 
            onClick={() => setSortBy("percent")}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-sm transition-colors ${sortBy === "percent" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            %
          </button>
          <button 
            onClick={() => setSortBy("amount")}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-sm transition-colors ${sortBy === "amount" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            €
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3 grid grid-cols-2 gap-4">
        {/* Best */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Ganadoras
          </div>
          {best.length > 0 ? best.map(p => (
            <div key={p.ticker} className="flex justify-between items-center text-sm gap-2">
              <span className="text-foreground/80 font-medium truncate flex-1" title={p.nombre || p.ticker}>
                {getDisplayName(p)}
              </span>
              <div className="flex items-center justify-end shrink-0">
                {sortBy === "percent" ? (
                  <span className="text-emerald-400 font-tabular">{formatPercent(p.change_percent_24h || 0)}</span>
                ) : (
                  <span className="text-emerald-400 font-tabular">{formatPnl(p.change_amount_24h!)}</span>
                )}
              </div>
            </div>
          )) : <span className="text-xs text-muted-foreground/60">Todo en rojo hoy 📉</span>}
        </div>
        {/* Worst */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">
            <TrendingDown className="w-3.5 h-3.5" />
            Perdedoras
          </div>
          {worst.length > 0 ? worst.map(p => (
            <div key={p.ticker} className="flex justify-between items-center text-sm gap-2">
              <span className="text-foreground/80 font-medium truncate flex-1" title={p.nombre || p.ticker}>
                {getDisplayName(p)}
              </span>
              <div className="flex items-center justify-end shrink-0">
                {sortBy === "percent" ? (
                  <span className="text-rose-400 font-tabular">{formatPercent(p.change_percent_24h || 0)}</span>
                ) : (
                  <span className="text-rose-400 font-tabular">{formatPnl(p.change_amount_24h!)}</span>
                )}
              </div>
            </div>
          )) : <span className="text-xs text-muted-foreground/60">¡Todo en verde! 🚀</span>}
        </div>
      </CardContent>
    </Card>
  )
}
