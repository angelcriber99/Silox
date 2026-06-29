import type { EnrichedPosition } from '@/lib/types'

export interface OpportunityScore {
  activo_id: string
  ticker: string
  nombre: string
  score: number
  reasons: string[]
  targetAllocation?: number
  recommendedAmount: number
  currentPrice: number
  targetMeanPrice?: number
  fiftyTwoWeekHigh?: number
}

export interface AdvisorConfig {
  mode: 'hybrid' | 'strategy' | 'opportunity'
  targetAllocations?: Record<string, number>
}

export function calculateAdvisorRecommendations(
  positions: EnrichedPosition[],
  liquidityAvailable: number,
  config: AdvisorConfig,
  extendedStats: Record<string, any>
): OpportunityScore[] {
  const recommendations: OpportunityScore[] = []
  
  if (liquidityAvailable <= 0) return []

  const totalInvestedValue = positions
    .filter(p => p.tipo !== 'Liquidez')
    .reduce((acc, p) => acc + (p.valor_actual || 0), 0)
    
  const totalValueWithLiquidity = totalInvestedValue + liquidityAvailable

  positions.forEach(pos => {
    if (pos.tipo === 'Liquidez') return
    
    let score = 0
    const reasons: string[] = []
    const stats = extendedStats[pos.ticker] || {}
    
    // 1. Oportunidad por Precio (Pérdida latente)
    if (pos.pnl_percent && pos.pnl_percent < 0) {
      const dropScore = Math.abs(pos.pnl_percent) * 2
      score += dropScore
      reasons.push(`Caída del ${Math.abs(pos.pnl_percent).toFixed(2)}% desde tu precio de compra`)
    }

    // 2. Oportunidad por Análisis Técnico (Caída desde ATH)
    if (stats.fiftyTwoWeekHigh && pos.precio_actual) {
      const dropFromHigh = ((stats.fiftyTwoWeekHigh - pos.precio_actual) / stats.fiftyTwoWeekHigh) * 100
      if (dropFromHigh > 5) {
        score += dropFromHigh * 1.5
        reasons.push(`A un ${dropFromHigh.toFixed(2)}% de su máximo de 52 semanas`)
      }
    }

    // 3. Potencial Alcista (Target Price de Analistas)
    if (stats.targetMeanPrice && pos.precio_actual) {
      const potential = ((stats.targetMeanPrice - pos.precio_actual) / pos.precio_actual) * 100
      if (potential > 0) {
        score += potential * 2
        reasons.push(`Potencial alcista del ${potential.toFixed(2)}% según analistas`)
      }
    }

    // 4. Estrategia (Target Allocations)
    let strategyMultiplier = 1
    if (config.targetAllocations && config.targetAllocations[pos.ticker]) {
      const targetPct = config.targetAllocations[pos.ticker]
      const currentPct = ((pos.valor_actual || 0) / totalValueWithLiquidity) * 100
      
      if (currentPct < targetPct) {
        const gap = targetPct - currentPct
        score += gap * 5
        reasons.push(`Por debajo de tu objetivo del ${targetPct}% (actual: ${currentPct.toFixed(2)}%)`)
        strategyMultiplier = 1.2
      } else {
        score = score * 0.2
        reasons.push(`Ya has superado tu objetivo del ${targetPct}%`)
        strategyMultiplier = 0.5
      }
    }

    // Default base score for active holdings if we want to just compound
    if (score === 0 && pos.pnl_percent !== null && pos.pnl_percent > 0) {
      score += 5 // Momentum factor
      reasons.push(`Buen momentum: +${pos.pnl_percent.toFixed(2)}% en verde`)
    }

    if (score > 0) {
      recommendations.push({
        activo_id: pos.activo_id,
        ticker: pos.ticker,
        nombre: pos.nombre || pos.ticker,
        score: score * strategyMultiplier,
        reasons,
        recommendedAmount: 0,
        currentPrice: pos.precio_actual || 0,
        targetMeanPrice: stats.targetMeanPrice,
        fiftyTwoWeekHigh: stats.fiftyTwoWeekHigh
      })
    }
  })

  recommendations.sort((a, b) => b.score - a.score)

  const topRecommendations = recommendations.slice(0, 3).filter(r => r.score > 3)
  
  if (topRecommendations.length > 0) {
    const totalTopScore = topRecommendations.reduce((acc, r) => acc + r.score, 0)
    
    topRecommendations.forEach(r => {
      const weight = r.score / totalTopScore
      r.recommendedAmount = liquidityAvailable * weight
    })
  } else if (recommendations.length > 0) {
    // If scores are too low, just recommend the top 1
    recommendations[0].recommendedAmount = liquidityAvailable
    topRecommendations.push(recommendations[0])
  }

  return topRecommendations
}
