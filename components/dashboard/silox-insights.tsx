"use client"

import { useMemo, useState, useEffect } from "react"
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight, BellRing } from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useAlerts } from "@/lib/hooks/use-alerts"

const FINANCIAL_TIPS = [
  "El interés compuesto es la octava maravilla del mundo. Mantén tu estrategia a largo plazo.",
  "Revisa tus aportaciones mensuales; mantener un DCA constante reduce el riesgo.",
  "No intentes predecir el mercado (market timing); el tiempo en el mercado es lo que cuenta.",
  "Diversificar tu cartera no es solo comprar muchos activos, es comprar activos descorrelacionados.",
  "Los mercados bajistas son el momento donde se construye la verdadera riqueza.",
  "Ten siempre un fondo de emergencia en efectivo antes de invertir dinero que puedas necesitar.",
  "Las emociones son el peor enemigo del inversor. Mantén la cabeza fría cuando el mercado caiga.",
  "Rebalancea tu cartera al menos una vez al año para mantener tu perfil de riesgo objetivo.",
  "Entiende los costes y comisiones; a largo plazo tienen un impacto gigante en tu rentabilidad.",
  "Invertir no es un sprint, es una maratón de décadas.",
  "Nunca inviertas en algo que no entiendes perfectamente.",
  "Los dividendos reinvertidos son responsables de una gran parte de la rentabilidad histórica de la bolsa.",
  "Cuidado con el sesgo de confirmación: busca también opiniones contrarias a tu tesis de inversión.",
  "El mejor momento para plantar un árbol fue hace 20 años. El segundo mejor momento es hoy.",
  "Mantén tus gastos de inversión (TER) lo más bajos posible.",
  "La volatilidad es el precio que pagas por la rentabilidad superior a largo plazo.",
  "No mires tu cartera todos los días. A largo plazo, el ruido diario no importa.",
  "Tu mayor activo financiero es tu capacidad de generar ingresos en tu trabajo.",
  "Evita el 'FOMO'. Si una inversión está en todas partes, a menudo ya es tarde.",
  "Una caída del 50% requiere una subida del 100% solo para recuperar lo perdido.",
  "Cíñete a tu plan, especialmente cuando todo el mundo está entrando en pánico.",
  "Las caídas de mercado del 10-20% ocurren casi cada año. Acéptalas como algo normal.",
  "No inviertas dinero que vayas a necesitar en los próximos 3-5 años.",
  "La simplicidad en una cartera (como 2-3 fondos indexados) suele batir a la complejidad.",
  "Lo que haces importa mucho más de lo que hace el mercado."
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

    // Insight 4: Proximity to active alerts
    if (alerts && alerts.length > 0) {
      const activeAlerts = alerts.filter(a => !a.triggered)
      let alertInsightAdded = false

      for (const alert of activeAlerts) {
        const position = positions.find(p => p.ticker.toUpperCase() === alert.ticker.toUpperCase())
        const currentPrice = position?.precio_actual_nativo || position?.precio_actual
        if (position && currentPrice && currentPrice > 0) {
          const distance = Math.abs((currentPrice - alert.target_price) / alert.target_price)
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

    // Keep tips deterministic so rendering remains pure and hydration-safe.
    const tipOffset = positions.length % FINANCIAL_TIPS.length
    list.push(...Array.from({ length: 3 }, (_, index) =>
      FINANCIAL_TIPS[(tipOffset + index) % FINANCIAL_TIPS.length],
    ))

    return list
  }, [positions, totals, alerts])

  // Auto-rotate insights every 30 seconds
  useEffect(() => {
    if (insights.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % insights.length)
    }, 30000)
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
