"use client"

import { useEffect } from "react"
import { usePreferences, AccentColor } from "@/lib/stores/use-preferences"
import { Celebration } from "@/components/dashboard/celebration"

const ACCENT_COLORS: Record<AccentColor, string> = {
  blue: 'oklch(0.65 0.2 250)',
  emerald: 'oklch(0.65 0.2 155)',
  violet: 'oklch(0.60 0.2 300)',
  rose: 'oklch(0.62 0.2 15)',
  amber: 'oklch(0.72 0.18 55)'
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { accentColor } = usePreferences()

  useEffect(() => {
    const root = document.documentElement
    const color = ACCENT_COLORS[accentColor] || ACCENT_COLORS.blue
    root.style.setProperty('--primary', color)
  }, [accentColor])

  return (
    <>
      {children}
      <Celebration />
    </>
  )
}
