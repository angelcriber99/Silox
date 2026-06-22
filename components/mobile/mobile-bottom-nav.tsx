"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, History, Plus, Settings } from "lucide-react"

interface MobileBottomNavProps {
  onAddPress: () => void
}

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()

  const tabs = [
    { name: "Inicio", href: "/", icon: LayoutDashboard },
    { name: "Historial", href: "/movimientos", icon: History },
    { name: "Añadir", href: "#", icon: Plus, isFab: true },
    { name: "Perfil", href: "/perfil", icon: Settings },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-background/80 backdrop-blur-2xl border-t border-border">
        <div className="flex items-center justify-around px-6 h-16 pb-[env(safe-area-inset-bottom,0px)]">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href
            if (tab.isFab) {
              return (
                <button
                  key={tab.name}
                  onClick={onAddPress}
                  className="flex items-center justify-center"
                >
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg shadow-violet-500/25 flex items-center justify-center active:scale-95 transition-transform duration-150">
                    <Plus className="h-6 w-6 text-white stroke-[2.5]" />
                  </div>
                </button>
              )
            }
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`relative flex flex-col items-center justify-center w-16 h-full transition-colors duration-200 ${
                  isActive ? "text-white" : "text-muted-foreground/80"
                }`}
              >
                <tab.icon
                  className={`h-5 w-5 ${
                    isActive ? "text-violet-400" : ""
                  }`}
                />
                <span className="text-[10px] font-semibold mt-1 tracking-wide">
                  {tab.name}
                </span>
                <div
                  className={`absolute bottom-2 w-1 h-1 rounded-full bg-violet-400 transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
