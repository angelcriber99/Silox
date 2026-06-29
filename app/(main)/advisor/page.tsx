"use client"

import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { useEffect, useState } from "react"
import { calculateAdvisorRecommendations, type OpportunityScore } from "@/lib/advisor/engine"
import { Card } from "@/components/ui/card"
import { Target, TrendingUp, AlertTriangle, Sparkles, Loader2, ArrowRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatters"

export default function AdvisorPage() {
  const { positions, isLoading } = usePortfolio()
  const liquidezAmount = positions?.find(p => p.tipo === 'Liquidez')?.valor_actual || 0
  const [recommendations, setRecommendations] = useState<OpportunityScore[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  useEffect(() => {
    async function analyze() {
      if (!positions || positions.length === 0 || liquidezAmount <= 0) return
      
      setIsAnalyzing(true)
      try {
        const tickers = positions.filter((p: any) => p.tipo !== 'Liquidez').map((p: any) => p.ticker)
        
        const res = await fetch('/api/advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers })
        })
        
        const extendedStats = await res.json()
        
        const recs = calculateAdvisorRecommendations(
          positions as any, 
          liquidezAmount,
          { mode: 'hybrid' }, // Configuración por defecto
          extendedStats
        )
        
        setRecommendations(recs)
      } catch (err) {
        console.error("Error analyzing portfolio", err)
      } finally {
        setIsAnalyzing(false)
      }
    }
    
    if (positions && positions.length > 0 && liquidezAmount > 0) {
      analyze()
    }
  }, [positions, liquidezAmount])

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50 mb-4" />
        <p className="text-muted-foreground animate-pulse">Cargando tu cartera...</p>
      </div>
    )
  }

  if (liquidezAmount <= 0) {
    return (
      <div className="flex-1 p-6 lg:p-10 max-w-5xl mx-auto w-full flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Smart Advisor</h1>
        <p className="text-muted-foreground max-w-md">
          Tu asistente de inversión basado en inteligencia de datos. 
          Actualmente no tienes Liquidez disponible para invertir. Cuando ingreses dinero en efectivo, vuelve aquí para recibir recomendaciones personalizadas.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="relative text-center mb-12">
        <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
          <Sparkles className="w-4 h-4" />
          Silox AI Advisor
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">Recomendación de Inversión</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Tienes <span className="font-bold text-foreground">{formatCurrency(liquidezAmount)}</span> listos para invertir. 
          Aquí tienes nuestra propuesta basada en caídas de mercado y potencial analítico.
        </p>
      </header>

      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
          </div>
          <p className="mt-6 text-lg font-medium text-muted-foreground animate-pulse">
            Analizando caídas, fundamentales y objetivos...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Shopping List
          </h2>
          
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((rec, i) => (
                <Card key={rec.activo_id} className="p-6 relative overflow-hidden group hover:border-primary/50 transition-colors">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold">{rec.ticker}</h3>
                      <p className="text-muted-foreground text-sm line-clamp-1">{rec.nombre}</p>
                    </div>
                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg font-semibold text-lg">
                      {formatCurrency(rec.recommendedAmount)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Motivos</p>
                    {rec.reasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>

                  <button className="w-full mt-6 py-2.5 rounded-xl bg-card border hover:bg-muted transition-colors text-sm font-semibold flex items-center justify-center gap-2 group-hover:border-primary/30">
                    Comprar {rec.ticker}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center border-dashed">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No hay oportunidades claras</h3>
              <p className="text-muted-foreground">
                Actualmente todos tus activos parecen estar en máximos o no presentan caídas significativas que justifiquen una entrada agresiva según nuestro algoritmo.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
