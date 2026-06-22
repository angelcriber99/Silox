"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EnrichedPosition } from '@/lib/types'
import { formatPercent } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown } from "lucide-react"

export function TopMovers({ positions }: { positions: EnrichedPosition[] }) {
  const validPositions = positions.filter(p => typeof p.pnl_percent === 'number' && p.pnl_percent !== 0)
  
  const sorted = [...validPositions].sort((a, b) => (b.pnl_percent || 0) - (a.pnl_percent || 0))
  
  const best = sorted.slice(0, 3)
  const worst = sorted.slice().reverse().slice(0, 3).filter(p => !best.find(b => b.ticker === p.ticker))

  return (
    <Card className="bg-[#111113] border-border">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-sm font-medium text-muted-foreground">🔥 Top Movimientos</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-2 gap-4">
        {/* Best */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Ganadoras
          </div>
          {best.length > 0 ? best.map(p => (
            <div key={p.ticker} className="flex justify-between items-center text-sm">
              <span className="text-foreground/80 font-medium truncate max-w-[80px]" title={p.nombre || p.ticker}>
                {p.ticker.split('.')[0]}
              </span>
              <span className="text-emerald-400 font-tabular">{formatPercent(p.pnl_percent || 0)}</span>
            </div>
          )) : <span className="text-xs text-muted-foreground/60">Sin datos</span>}
        </div>
        {/* Worst */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">
            <TrendingDown className="w-3.5 h-3.5" />
            Perdedoras
          </div>
          {worst.length > 0 ? worst.map(p => (
            <div key={p.ticker} className="flex justify-between items-center text-sm">
              <span className="text-foreground/80 font-medium truncate max-w-[80px]" title={p.nombre || p.ticker}>
                {p.ticker.split('.')[0]}
              </span>
              <span className="text-rose-400 font-tabular">{formatPercent(p.pnl_percent || 0)}</span>
            </div>
          )) : <span className="text-xs text-muted-foreground/60">Sin datos</span>}
        </div>
      </CardContent>
    </Card>
  )
}
