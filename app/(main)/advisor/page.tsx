"use client"

import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { useEffect, useState } from "react"
import { calculateAdvisorRecommendations, type OpportunityScore } from "@/lib/advisor/engine"
import { Card } from "@/components/ui/card"
import { Target, AlertTriangle, Activity, CheckCircle2, ChevronRight, Sparkles, Loader2 } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils/formatters"

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
          { mode: 'quant' }, // Configuración por defecto
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
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4 tracking-tight">Quant Advisor</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Tu asistente de inversión basado en modelos cuantitativos. 
          Actualmente no tienes liquidez disponible para invertir. Cuando ingreses dinero en efectivo, vuelve aquí para recibir recomendaciones basadas en multifactor scoring.
        </p>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 60) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-rose-500 bg-rose-500/10 border-rose-500/30";
  }

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-rose-500";
  }

  return (
    <div className="flex-1 p-6 lg:p-10 max-w-6xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="relative text-center mb-12">
        <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 border border-primary/20 backdrop-blur-sm">
          <Activity className="w-4 h-4" />
          Quant Engine v2.0
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">Análisis de Oportunidades</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Capital disponible: <span className="font-bold text-foreground">{formatCurrency(liquidezAmount)}</span>. 
          Sistema de scoring multifactor: Valoración, Tendencia, Analistas y Crecimiento.
        </p>
      </header>

      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
          </div>
          <p className="mt-6 text-lg font-medium text-muted-foreground animate-pulse">
            Ejecutando modelo cuantitativo...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Recomendaciones del Modelo
            </h2>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Fuerte Compra (≥80)</span>
              <span className="flex items-center gap-1.5 ml-4"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Compra (≥60)</span>
            </div>
          </div>
          
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {recommendations.map((rec, i) => (
                <Card key={rec.activo_id} className="p-6 relative overflow-hidden group hover:border-primary/40 transition-all bg-card/40 backdrop-blur-sm border-white/5 shadow-xl">
                  {/* Decorative background for the card */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                  
                  {/* Header: Title and Overall Score */}
                  <div className="flex justify-between items-start mb-6 relative">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl font-bold tracking-tight">{rec.ticker}</h3>
                        <div className={`px-2.5 py-0.5 rounded-md text-sm font-bold border ${getScoreColor(rec.score)}`}>
                          {rec.score.toFixed(0)} / 100
                        </div>
                      </div>
                      <p className="text-muted-foreground">{rec.nombre}</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Asignación Sugerida</p>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(rec.recommendedAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Factor Breakdown */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6 p-4 rounded-xl bg-black/20 border border-white/5">
                    {Object.entries(rec.factors).map(([key, factor]) => (
                      <div key={key} className="space-y-1.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium">{factor.name}</span>
                          <span className="font-bold">{factor.score.toFixed(0)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${getProgressColor(factor.score)}`} 
                            style={{ width: `${Math.min(100, Math.max(0, factor.score))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                      <p className="text-xs text-muted-foreground mb-1">Precio Actual</p>
                      <p className="font-semibold">{rec.metrics?.currentPrice ? formatCurrency(rec.metrics.currentPrice) : '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                      <p className="text-xs text-muted-foreground mb-1">Precio Obj.</p>
                      <p className="font-semibold">{rec.metrics?.targetMeanPrice ? formatCurrency(rec.metrics.targetMeanPrice) : '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                      <p className="text-xs text-muted-foreground mb-1">PER Fwd</p>
                      <p className="font-semibold">{rec.metrics?.forwardPE ? formatNumber(rec.metrics.forwardPE) : '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                      <p className="text-xs text-muted-foreground mb-1">Div. Yield</p>
                      <p className="font-semibold">{rec.metrics?.dividendYield ? `${(rec.metrics.dividendYield * 100).toFixed(2)}%` : '-'}</p>
                    </div>
                  </div>

                  {/* Reasons */}
                  <div className="space-y-2.5 mb-6">
                    {rec.reasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground leading-relaxed">{reason}</span>
                      </div>
                    ))}
                  </div>

                  <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                    Ejecutar Orden
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed bg-card/40 backdrop-blur-sm">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Sin señales de entrada</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                El modelo cuantitativo no ha detectado oportunidades con un score suficiente para justificar la asignación de capital en este momento.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
