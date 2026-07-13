"use client"

import { useEffect } from "react"
import { usePreferences, AccentColor } from "@/lib/stores/use-preferences"
import { Celebration } from "@/components/dashboard/celebration"

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { amoled } = usePreferences()

  useEffect(() => {
    const root = document.documentElement
    
    if (amoled) {
      root.classList.add('amoled')
    } else {
      root.classList.remove('amoled')
    }
  }, [amoled])

  return (
    <>
      {children}
      <Celebration />
    </>
  )
}
