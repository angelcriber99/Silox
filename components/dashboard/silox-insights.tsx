"use client"

import { useMemo, useState, useEffect } from "react"
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useAlerts } from "@/lib/hooks/use-alerts"
import { motion, AnimatePresence } from "framer-motion"

const FINANCIAL_TIPS = [
  "El interés compuesto es la octava maravilla del mundo. Mantén tu estrategia a largo plazo.",
  "Revisa tus aportaciones mensuales; mantener un DCA constante reduce el riesgo.",
  "No intentes predecir el mercado (market timing); el tiempo en el mercado es lo que cuenta.",
  "Diversificar tu cartera no es solo comprar muchos activos, es comprar activos descorrelacionados.",
  "Los mercados bajistas son el momento donde se construye la verdadera riqueza.",
  "Ten siempre un fondo de emergencia en efectivo antes de invertir dinero que puedas necesitar.",
  "Las emociones son el peor enemigo del inversor. Mantén la cabeza fría cuando el mercado caiga.",
  "Rebalancea tu cartera al menos una vez al año para mantener tu perfil de riesgo objetivo."
]

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
    if (totals.totalDailyPnlPercent >= 1) {
      list.push(`Excelente día de mercado. Tu portfolio ha subido un ${formatPercent(totals.totalDailyPnlPercent)} hoy.`)
    } else if (totals.totalDailyPnlPercent <= -1) {
      list.push(`Día complicado en el mercado. Un descenso del ${formatPercent(totals.totalDailyPnlPercent)}, buena oportunidad para revisar fundamentales.`)
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
    if (positions.length > 2 && totals.valueMoney.amount > 0) {
      const biggestPosition = [...positions].sort((a, b) => ((b.displayValue?.amount ?? null) || 0) - ((a.displayValue?.amount ?? null) || 0))[0]
      const concentration = ((biggestPosition.displayValue?.amount ?? null) || 0) / totals.valueMoney.amount * 100
      
      if (concentration > 30) {
        list.push(`Alta concentración: El ${formatPercent(concentration)} de tu cartera depende de ${biggestPosition.nombre || biggestPosition.ticker.split('.')[0]}.`)
      } else {
        list.push("Tienes una cartera bien diversificada, ningún activo supera el 30% del total.")
      }
    }

    // Add random tip
    const tipIndex = Math.floor(Math.random() * FINANCIAL_TIPS.length)
    list.push(`💡 ${FINANCIAL_TIPS[tipIndex]}`)

    return list
  }, [positions, totals.totalDailyPnlPercent, totals.valueMoney.amount, alerts])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % insights.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [insights.length])

  if (!insights.length) return null

  return (
    <div className="flex flex-col glass-card border rounded-xl overflow-hidden relative shadow-sm">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Resumen Inteligente</h3>
        </div>
        {/* Navigation */}
        {insights.length > 1 && (
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentIndex((prev) => (prev === 0 ? insights.length - 1 : prev - 1))}
              className="p-1 hover:bg-background/80 rounded-md transition-colors"
            >
              <ChevronLeft className="w-3 h-3 text-muted-foreground" />
            </button>
            <span className="text-[10px] text-muted-foreground font-medium tabular-nums px-1">
              {currentIndex + 1}/{insights.length}
            </span>
            <button 
              onClick={() => setCurrentIndex((prev) => (prev + 1) % insights.length)}
              className="p-1 hover:bg-background/80 rounded-md transition-colors"
            >
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-4 min-h-[70px] flex items-center relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex-1"
          >
            <p className="text-[12px] leading-relaxed text-foreground/90 pr-2">
              {insights[currentIndex]}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
