"use client"

import { useRouter, usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"

const TOP_LEVEL_PAGES = [
  "/",
  "/movimientos",
  "/radar",
  "/analisis",
  "/historial",
  "/declarar",
  "/settings",
  "/perfil"
]

export function GlobalBackButton() {
  const router = useRouter()
  const pathname = usePathname()
  
  if (TOP_LEVEL_PAGES.includes(pathname) || pathname.startsWith("/login")) {
    return null
  }

  return (
    <div className="fixed top-[max(1rem,env(safe-area-inset-top))] left-4 z-[100] md:top-6 md:left-6">
      <button
        onClick={() => router.back()}
        className="flex items-center justify-center h-10 w-10 md:h-11 md:w-11 rounded-full bg-background/80 backdrop-blur-md border border-white/10 shadow-lg hover:bg-white/10 transition-colors"
        aria-label="Volver"
      >
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>
    </div>
  )
}
