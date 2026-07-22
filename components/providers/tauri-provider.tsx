"use client"

import { useEffect, useState } from "react"

export function TauriProvider({ children }: { children: React.ReactNode }) {
  const [isTauri, setIsTauri] = useState(false)

  useEffect(() => {
    // Check if running in Tauri
    const isTauriEnv = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined
    
    if (isTauriEnv) {
      setIsTauri(true)
      document.documentElement.classList.add("tauri-app")
    }
  }, [])

  return <>{children}</>
}
