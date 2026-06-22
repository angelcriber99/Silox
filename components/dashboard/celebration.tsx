"use client"

import { useEffect, useState } from "react"
import confetti from "canvas-confetti"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { usePreferences } from "@/lib/stores/use-preferences"
import { playSound } from "@/lib/utils/sounds"

export function Celebration() {
  const { totals } = usePortfolio()
  const { celebrationMode, soundEffects } = usePreferences()
  const [hasCelebrated, setHasCelebrated] = useState(false)

  useEffect(() => {
    // Only celebrate once per session, and only if celebration mode is enabled
    // and PnL% 24h is strictly greater than 1%
    if (celebrationMode && !hasCelebrated && totals.totalPnlPercent24h > 1) {
      setHasCelebrated(true)
      
      if (soundEffects) {
        playSound('celebration')
      }

      const duration = 3000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b']
        })
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b']
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()
    }
  }, [totals.totalPnlPercent24h, celebrationMode, hasCelebrated, soundEffects])

  return null
}
