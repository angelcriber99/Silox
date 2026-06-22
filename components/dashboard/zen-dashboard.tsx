"use client"

import { usePreferences } from "@/lib/stores/use-preferences"
import { formatCurrency, formatPnl, formatPercent } from "@/lib/utils/formatters"
import type { PortfolioTotals, EnrichedPosition } from "@/lib/types"
import { EyeOff, TrendingUp, TrendingDown, Target } from "lucide-react"
import { AllocationChart } from "./allocation-chart"

interface ZenDashboardProps {
  totals: PortfolioTotals
  positions: EnrichedPosition[]
}

export function ZenDashboard({ totals, positions }: ZenDashboardProps) {
  const { setZenMode, hideBalances } = usePreferences()
  const isPositive = totals.totalPnl >= 0

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700">
      {/* Botón de salida discreto */}
      <button
        onClick={() => setZenMode(false)}
        className="absolute top-8 right-8 p-3 rounded-full hover:bg-muted text-muted-foreground transition-all duration-300 hover:scale-105"
        title="Salir del Modo ZEN"
      >
        <EyeOff className="w-6 h-6" />
      </button>

      <div className="w-full max-w-4xl px-6 flex flex-col items-center space-y-16">
        
        {/* KPI Principal */}
        <div className="text-center space-y-4 animate-fade-in stagger-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            {hideBalances ? "Protección de Pantalla" : "Patrimonio Total"}
          </p>
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold font-tabular tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70 pb-4">
            {hideBalances ? "****" : formatCurrency(totals.totalValue)}
          </h1>
          
          {!hideBalances && (
            <div className="flex items-center justify-center gap-6 mt-4 opacity-80">
              <div className={`flex items-center gap-2 text-xl md:text-2xl font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                {totals.totalPnl > 0 ? "+" : ""}{formatPnl(totals.totalPnl)}
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-border" />
              <div className={`flex items-center gap-2 text-xl md:text-2xl font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                <Target className="w-6 h-6" />
                {totals.totalPnlPercent > 0 ? "+" : ""}{formatPercent(totals.totalPnlPercent)}
              </div>
            </div>
          )}
        </div>

        {/* Gráfico de Distribución (Ultra Limpio) */}
        <div className="w-full max-w-2xl opacity-60 hover:opacity-100 transition-opacity duration-700 animate-fade-in stagger-2">
          <div className="scale-90 md:scale-100">
            <AllocationChart positions={positions} />
          </div>
        </div>

      </div>
    </div>
  )
}
