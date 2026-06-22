"use client"

import { useMemo, useState, useEffect } from "react"
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"

export function SiloxInsights({
  positions,
  totals
}: {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
}) {
  const { hideBalances } = usePreferences()
  const [currentIndex, setCurrentIndex] = useState(0)

  const insights = useMemo(() => {
    const list: string[] = []

    if (positions.length === 0) {
      list.push("Añade tu primera posición para que pueda darte insights inteligentes.")
      return list
    }

    // Insight 1: Daily Performance
    if (totals.totalPnlPercent24h >= 1) {
      list.push(`Excelente día de mercado. Tu portfolio ha subido un ${formatPercent(totals.totalPnlPercent24h)} hoy.`)
    } else if (totals.totalPnlPercent24h <= -1) {
      list.push(`Día complicado en el mercado. Un descenso del ${formatPercent(totals.totalPnlPercent24h)}, buena oportunidad para revisar fundamentales.`)
    } else {
      list.push("Sesión tranquila en los mercados, sin grandes sobresaltos en tu cartera.")
    }

    // Insight 2: Top Mover
    const validPositions = positions.filter(p => typeof p.change_percent_24h === 'number' && p.change_percent_24h !== 0)
    if (validPositions.length > 0) {
      const sorted = [...validPositions].sort((a, b) => (b.change_percent_24h || 0) - (a.change_percent_24h || 0))
      const top = sorted[0]
      const worst = sorted[sorted.length - 1]

      if (top.change_percent_24h! > 3) {
        list.push(`${top.nombre || top.ticker.split('.')[0]} está tirando fuerte del carro hoy con una subida del ${formatPercent(top.change_percent_24h!)}.`)
      } else if (worst.change_percent_24h! < -3) {
        list.push(`${worst.nombre || worst.ticker.split('.')[0]} está lastrando el portfolio con una caída del ${formatPercent(worst.change_percent_24h!)}.`)
      }
    }

    // Insight 3: Concentration
    if (positions.length > 2 && totals.totalValue > 0) {
      const biggestPosition = [...positions].sort((a, b) => (b.valor_actual || 0) - (a.valor_actual || 0))[0]
      const concentration = (biggestPosition.valor_actual || 0) / totals.totalValue * 100
      
      if (concentration > 30) {
        list.push(`Alta concentración: El ${formatPercent(concentration)} de tu cartera depende de ${biggestPosition.nombre || biggestPosition.ticker.split('.')[0]}.`)
      } else {
        list.push("Tienes una cartera bien diversificada, ningún activo supera el 30% del total.")
      }
    }

    return list
  }, [positions, totals])

  // Auto-rotate insights every 8 seconds
  useEffect(() => {
    if (insights.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % insights.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [insights.length])

  if (insights.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-violet-500/10 border border-border/50 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group">
      {/* Sparkles icon */}
      <div className="bg-background/80 p-2 rounded-full shadow-sm backdrop-blur-md shrink-0">
        <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
      </div>

      {/* Insight Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground/90 truncate animate-fade-in" key={currentIndex}>
          {insights[currentIndex]}
        </p>
      </div>

      {/* Navigation */}
      {insights.length > 1 && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => setCurrentIndex((prev) => (prev === 0 ? insights.length - 1 : prev - 1))}
            className="p-1 hover:bg-background/80 rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-[10px] text-muted-foreground font-medium tabular-nums px-1">
            {currentIndex + 1}/{insights.length}
          </span>
          <button 
            onClick={() => setCurrentIndex((prev) => (prev + 1) % insights.length)}
            className="p-1 hover:bg-background/80 rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}
