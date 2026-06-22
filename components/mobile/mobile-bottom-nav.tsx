"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, History, Plus, Settings, FileText } from "lucide-react"
import { playSound } from "@/lib/utils/sounds"
import { usePreferences } from "@/lib/stores/use-preferences"

interface MobileBottomNavProps {
  onAddPress: () => void
}

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()
  const { soundEffects } = usePreferences()

  const tabs = [
    { name: "Inicio", href: "/", icon: LayoutDashboard },
    { name: "Historial", href: "/movimientos", icon: History },
    { name: "Añadir", href: "#", icon: Plus, isFab: true },
    { name: "Declarar", href: "/declarar", icon: FileText },
    { name: "Perfil", href: "/perfil", icon: Settings },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-2xl border-t border-border/50" />
      <div className="relative flex items-end justify-between px-2 pb-[env(safe-area-inset-bottom,0px)] h-16">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href

          if (tab.isFab) {
            return (
              <div key="fab-container" className="relative flex-1 flex justify-center h-full">
                <button
                  onClick={() => {
                    if (soundEffects) playSound('click')
                    onAddPress()
                  }}
                  className="absolute -top-5 flex items-center justify-center outline-none"
                >
                  <div className="h-14 w-14 rounded-full bg-primary shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 active:shadow-sm transition-all duration-200 border-4 border-background">
                    <Plus className="h-7 w-7 text-primary-foreground stroke-[2.5]" />
                  </div>
                </button>
                {/* Space holder for the FAB text */}
                <span className="absolute bottom-1 text-[10px] font-semibold text-muted-foreground/60 tracking-wide">
                  {tab.name}
                </span>
              </div>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => { if (soundEffects) playSound('click') }}
              className={`relative flex-1 flex flex-col items-center justify-center h-full transition-colors duration-200 pb-1 ${
                isActive ? "text-primary" : "text-muted-foreground/70"
              }`}
            >
              <div className="relative mb-1">
                <tab.icon
                  className={`h-5 w-5 transition-transform duration-200 ${
                    isActive ? "scale-110" : "scale-100"
                  }`}
                />
              </div>
              <span className={`text-[10px] font-semibold tracking-wide transition-colors ${
                isActive ? "text-foreground" : ""
              }`}>
                {tab.name}
              </span>
              {isActive && (
                <div className="absolute top-0 w-8 h-1 rounded-b-full bg-primary opacity-80" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
