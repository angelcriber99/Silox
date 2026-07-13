"use client"

import { useEffect, useRef } from "react"
import confetti from "canvas-confetti"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { usePreferences } from "@/lib/stores/use-preferences"

export function Celebration() {
  const { totals } = usePortfolio()
  const { celebrationMode } = usePreferences()
  const hasCelebrated = useRef(false)

  useEffect(() => {
    // Only celebrate once per session, and only if celebration mode is enabled
    // and daily PnL percent is >= 2% (a real celebration)
    if (celebrationMode && !hasCelebrated.current && totals.totalPnlPercent24h >= 2) {
      hasCelebrated.current = true
      
      const duration = 3000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
          zIndex: 9999
        })
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
          zIndex: 9999
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()
    }
  }, [totals.totalPnlPercent24h, celebrationMode])

  return null
}
