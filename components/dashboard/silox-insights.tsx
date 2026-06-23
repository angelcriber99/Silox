"use client"

import { useMemo, useState, useEffect } from "react"
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight, BellRing } from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useAlerts } from "@/lib/hooks/use-alerts"

export function SiloxInsights({
  positions,
  totals
}: {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
}) {
  const { hideBalances } = usePreferences()
  const { alerts } = useAlerts()
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

    // Insight 4: Proximity to active alerts
    if (alerts && alerts.length > 0) {
      const activeAlerts = alerts.filter(a => !a.triggered)
      let alertInsightAdded = false

      for (const alert of activeAlerts) {
        const position = positions.find(p => p.ticker.toUpperCase() === alert.ticker.toUpperCase())
        if (position && position.price && position.price > 0) {
          const distance = Math.abs((position.price - alert.target_price) / alert.target_price)
          // If within 5% of the target price
          if (distance <= 0.05) {
            const distancePercent = formatPercent(distance * 100)
            list.push(`¡Ojo! ${position.nombre || position.ticker} está a solo un ${distancePercent} de tu alerta de ${formatCurrency(alert.target_price, position.moneda)}.`)
            alertInsightAdded = true
          }
        }
      }

      if (!alertInsightAdded && activeAlerts.length > 0) {
        list.push(`Tienes ${activeAlerts.length} ${activeAlerts.length === 1 ? 'alerta activa' : 'alertas activas'} vigilando el mercado por ti.`)
      }
    }

    // Insight 5: General Tips
    list.push("El interés compuesto es la octava maravilla del mundo. Mantén tu estrategia a largo plazo.")
    list.push("Revisa tus aportaciones mensuales; mantener un DCA constante reduce el riesgo.")

    return list
  }, [positions, totals, alerts])

  // Auto-rotate insights every 5 seconds
  useEffect(() => {
    if (insights.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % insights.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [insights.length])

  if (insights.length === 0) return null

  // Define icon based on current insight text to make it more dynamic
  const currentInsight = insights[currentIndex]
  const isAlert = currentInsight.includes("¡Ojo!") || currentInsight.includes("alerta")
  
  return (
    <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-violet-500/10 border border-border/50 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group">
      {/* Dynamic Icon */}
      <div className="bg-background/80 p-2 rounded-full shadow-sm backdrop-blur-md shrink-0">
        {isAlert ? (
          <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
        ) : (
          <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
        )}
      </div>

      {/* Insight Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground/90 truncate animate-fade-in" key={currentIndex}>
          {currentInsight}
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
