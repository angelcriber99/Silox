import type { EnrichedPosition } from '@/lib/types'

export interface AdvisorFactor {
  name: string
  score: number // 0-100
  weight: number
  description?: string
}

export interface OpportunityScore {
  activo_id: string
  ticker: string
  nombre: string
  score: number // Overall 0-100
  factors: Record<string, AdvisorFactor>
  reasons: string[]
  recommendedAmount: number
  metrics: {
    currentPrice: number
    targetMeanPrice?: number
    fiftyTwoWeekHigh?: number
    forwardPE?: number
    dividendYield?: number
  }
}

export interface AdvisorConfig {
  mode: 'quant'
}

export function calculateAdvisorRecommendations(
  positions: EnrichedPosition[],
  liquidityAvailable: number,
  config: AdvisorConfig,
  extendedStats: Record<string, any>
): OpportunityScore[] {
  const recommendations: OpportunityScore[] = []
  
  if (liquidityAvailable <= 0) return []

  positions.forEach(pos => {
    if (pos.tipo === 'Liquidez') return
    
    const stats = extendedStats[pos.ticker] || {}
    const price = pos.precio_actual || stats.currentPrice || 0
    
    if (price === 0) return // Skip if no price

    const reasons: string[] = []
    const factors: Record<string, AdvisorFactor> = {}

    // --- FACTOR 1: VALUATION (30% weight) ---
    // Look at P/E and Dividend Yield
    let valuationScore = 50 // baseline
    if (stats.forwardPE) {
      if (stats.forwardPE < 10) valuationScore += 30
      else if (stats.forwardPE < 15) valuationScore += 20
      else if (stats.forwardPE < 20) valuationScore += 10
      else if (stats.forwardPE > 30) valuationScore -= 20
      else if (stats.forwardPE > 50) valuationScore -= 40
      reasons.push(`PER Forward de ${stats.forwardPE.toFixed(1)}x`)
    }
    if (stats.dividendYield) {
      const yieldPct = stats.dividendYield * 100
      if (yieldPct > 4) valuationScore += 20
      else if (yieldPct > 2) valuationScore += 10
      if (yieldPct > 0) reasons.push(`Rentabilidad por dividendo: ${yieldPct.toFixed(2)}%`)
    }
    valuationScore = Math.max(0, Math.min(100, valuationScore))
    factors['valuation'] = { name: 'Valoración', score: valuationScore, weight: 0.3 }

    // --- FACTOR 2: MOMENTUM (20% weight) ---
    // Compare price to 50d and 200d averages, and ATH drops
    let momentumScore = 50
    if (stats.twoHundredDayAverage) {
      const dist200 = ((price - stats.twoHundredDayAverage) / stats.twoHundredDayAverage) * 100
      if (dist200 < -10) {
        momentumScore += 30 // Great buying opportunity if it's way below 200d average
        reasons.push(`Cotiza un ${Math.abs(dist200).toFixed(1)}% por debajo de su media de 200 días (Oportunidad de rebote)`)
      } else if (dist200 > 20) {
        momentumScore -= 20 // Might be overextended
        reasons.push(`Sobre-extendida: un ${dist200.toFixed(1)}% por encima de su media de 200 días`)
      }
    }
    if (stats.fiftyTwoWeekHigh) {
      const dropFromHigh = ((stats.fiftyTwoWeekHigh - price) / stats.fiftyTwoWeekHigh) * 100
      if (dropFromHigh > 15) {
        momentumScore += 20
        reasons.push(`Corrección del ${dropFromHigh.toFixed(1)}% desde sus máximos anuales`)
      }
    }
    momentumScore = Math.max(0, Math.min(100, momentumScore))
    factors['momentum'] = { name: 'Tendencia', score: momentumScore, weight: 0.2 }

    // --- FACTOR 3: ANALYST CONSENSUS (30% weight) ---
    let analystScore = 50
    if (stats.targetMeanPrice) {
      const potential = ((stats.targetMeanPrice - price) / price) * 100
      if (potential > 20) analystScore += 40
      else if (potential > 10) analystScore += 25
      else if (potential > 0) analystScore += 10
      else if (potential < 0) analystScore -= 30
      
      if (potential > 5) {
        reasons.push(`Consenso de analistas: Potencial alcista del +${potential.toFixed(1)}%`)
      } else if (potential < 0) {
        reasons.push(`Analistas proyectan una caída del ${potential.toFixed(1)}%`)
      }
    }
    
    // Boost based on Strong Buy / Buy ratings vs Sell ratings
    const totalRatings = (stats.analystStrongBuy || 0) + (stats.analystBuy || 0) + (stats.analystHold || 0) + (stats.analystSell || 0) + (stats.analystStrongSell || 0)
    if (totalRatings > 0) {
      const buyRatio = ((stats.analystStrongBuy || 0) + (stats.analystBuy || 0)) / totalRatings
      if (buyRatio > 0.7) analystScore += 10
      if (stats.recommendationKey === 'buy' || stats.recommendationKey === 'strongBuy') {
        reasons.push(`Recomendación general: ${stats.recommendationKey.toUpperCase()}`)
      }
    }
    analystScore = Math.max(0, Math.min(100, analystScore))
    factors['analyst'] = { name: 'Analistas', score: analystScore, weight: 0.3 }

    // --- FACTOR 4: GROWTH & PROFITABILITY (20% weight) ---
    let growthScore = 50
    if (stats.returnOnEquity) {
      const roe = stats.returnOnEquity * 100
      if (roe > 20) growthScore += 25
      else if (roe > 10) growthScore += 10
      else if (roe < 0) growthScore -= 20
      if (roe > 15) reasons.push(`Alto Retorno sobre Capital (ROE): ${roe.toFixed(1)}%`)
    }
    if (stats.profitMargins) {
      const margin = stats.profitMargins * 100
      if (margin > 20) growthScore += 25
      else if (margin < 0) growthScore -= 30
      if (margin > 20) reasons.push(`Márgenes de beneficio excepcionales: ${margin.toFixed(1)}%`)
    }
    growthScore = Math.max(0, Math.min(100, growthScore))
    factors['growth'] = { name: 'Crecimiento', score: growthScore, weight: 0.2 }

    // Calculate Final Weighted Score
    const finalScore = Math.round(
      (valuationScore * 0.3) + 
      (momentumScore * 0.2) + 
      (analystScore * 0.3) + 
      (growthScore * 0.2)
    )

    // Solo lo añadimos si tenemos suficiente data y el score no es un desastre total, o siempre
    recommendations.push({
      activo_id: pos.activo_id,
      ticker: pos.ticker,
      nombre: pos.nombre || pos.ticker,
      score: finalScore,
      factors,
      reasons: reasons.slice(0, 4), // Top 4 reasons max
      recommendedAmount: 0,
      metrics: {
        currentPrice: price,
        targetMeanPrice: stats.targetMeanPrice,
        fiftyTwoWeekHigh: stats.fiftyTwoWeekHigh,
        forwardPE: stats.forwardPE,
        dividendYield: stats.dividendYield
      }
    })
  })

  // Sort by highest score
  recommendations.sort((a, b) => b.score - a.score)

  // Filter those that are actually "Buys" (e.g., Score > 60)
  const topRecommendations = recommendations.filter(r => r.score >= 60).slice(0, 3)
  
  if (topRecommendations.length > 0) {
    const totalTopScore = topRecommendations.reduce((acc, r) => acc + r.score, 0)
    
    topRecommendations.forEach(r => {
      // Allocate liquidity proportionally to their score
      const weight = r.score / totalTopScore
      r.recommendedAmount = liquidityAvailable * weight
    })
    return topRecommendations
  }

  // Si no hay nada por encima de 60, devolvemos el mejor aunque sea mediocre (para no dejar la pantalla vacía), o devolvemos vacío.
  if (recommendations.length > 0 && recommendations[0].score > 40) {
    recommendations[0].recommendedAmount = liquidityAvailable
    return [recommendations[0]]
  }

  return []
}
