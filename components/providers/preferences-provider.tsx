"use client"

import { useEffect } from "react"
import { usePreferences, AccentColor } from "@/lib/stores/use-preferences"
import { Celebration } from "@/components/dashboard/celebration"

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    
    root.classList.remove('amoled')
  }, [])

  return (
    <>
      {children}
      <Celebration />
    </>
  )
}
