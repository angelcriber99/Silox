"use client"

import { usePreferences, type AccentColor } from "@/lib/stores/use-preferences"
import { useTheme } from "next-themes"
import { useEffect } from "react"

export const THEME_COLORS: Record<AccentColor, { light: string; dark: string }> = {
  blue: { light: "#007AFF", dark: "#0A84FF" },
  emerald: { light: "#34C759", dark: "#30D158" },
  violet: { light: "#5856D6", dark: "#5E5CE6" },
  rose: { light: "#FF3B30", dark: "#FF453A" },
  amber: { light: "#FF9500", dark: "#FF9F0A" },
  indigo: { light: "#5856D6", dark: "#5E5CE6" },
  teal: { light: "#5AC8FA", dark: "#64D2FF" },
  pink: { light: "#FF2D55", dark: "#FF375F" },
}

export function ThemeEngine() {
  const { accentColor } = usePreferences()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const isDark = resolvedTheme === "dark"
    const color = THEME_COLORS[accentColor]?.[isDark ? "dark" : "light"] || THEME_COLORS.blue.dark

    const root = document.documentElement
    
    root.style.setProperty("--primary", color)
    root.style.setProperty("--ring", color)
    
    // Default to crystal/macos style globally
    document.documentElement.setAttribute('data-preset', 'crystal')
  }, [accentColor, resolvedTheme])

  return null
}
