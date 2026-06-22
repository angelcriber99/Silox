"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, History, Plus } from "lucide-react"

interface MobileBottomNavProps {
  onAddPress: () => void
}

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()

  const tabs = [
    { name: "Inicio", href: "/", icon: LayoutDashboard },
    { name: "Añadir", href: "#", icon: Plus, isFab: true },
    { name: "Historial", href: "/movimientos", icon: History },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-[#09090b]/80 backdrop-blur-2xl border-t border-zinc-800/40">
        <div className="flex items-end justify-around px-2 h-16 pb-[env(safe-area-inset-bottom,8px)]">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href
            if (tab.isFab) {
              return (
                <button
                  key={tab.name}
                  onClick={onAddPress}
                  className="relative -mt-4 flex items-center justify-center"
                >
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg shadow-violet-500/25 flex items-center justify-center active:scale-95 transition-transform duration-150">
                    <Plus className="h-7 w-7 text-white stroke-[2.5]" />
                  </div>
                </button>
              )
            }
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-2 transition-colors duration-200 ${
                  isActive ? "text-white" : "text-zinc-500"
                }`}
              >
                <tab.icon
                  className={`h-[22px] w-[22px] ${
                    isActive ? "text-violet-400" : ""
                  }`}
                />
                <span className="text-[10px] font-semibold mt-1 tracking-wide">
                  {tab.name}
                </span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-violet-400 mt-0.5" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
