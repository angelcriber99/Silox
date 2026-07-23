"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeftRight, LayoutDashboard, Menu, Newspaper, Plus, type LucideIcon } from "lucide-react"

import { hapticFeedback } from "@/lib/utils/haptics"

interface MobileBottomNavProps {
  onAddPress: () => void
  onMorePress: () => void
}

interface MobileTab {
  name: string
  href: string
  Icon: LucideIcon
  isAction?: boolean
  isMore?: boolean
}

const tabs: MobileTab[] = [
  { name: "Cartera", href: "/", Icon: LayoutDashboard },
  { name: "Movimientos", href: "/movimientos", Icon: ArrowLeftRight },
  { name: "Añadir", href: "#", Icon: Plus, isAction: true },
  { name: "Radar", href: "/radar", Icon: Newspaper },
  { name: "Más", href: "#more", Icon: Menu, isMore: true },
]

const SECONDARY_ROUTES = ["/analisis", "/historial", "/declarar", "/settings"]

export function MobileBottomNav({ onAddPress, onMorePress }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Navegación principal"
    >
      <div className="flex items-center gap-1 rounded-[32px] bg-zinc-900/95 px-2 py-2 shadow-2xl backdrop-blur-xl border border-white/10 dark:bg-zinc-950/95 dark:border-white/5">
        {tabs.map((tab) => {
          const isActive = tab.isMore
            ? SECONDARY_ROUTES.some((route) => pathname.startsWith(route))
            : tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href)

          if (tab.isAction || tab.isMore) {
            const handlePress = tab.isAction ? onAddPress : onMorePress

            return (
              <button
                key={tab.name}
                type="button"
                onClick={() => {
                  hapticFeedback.medium()
                  handlePress()
                }}
                className={`relative flex items-center justify-center overflow-hidden whitespace-nowrap rounded-full transition-all duration-300 ${
                  isActive ? "bg-zinc-800 px-4 py-2.5 text-white" : "px-3 py-2.5 text-zinc-400 hover:text-zinc-300"
                }`}
                aria-label={tab.name}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.isAction ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-zinc-900 shadow-md">
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </span>
                ) : (
                  <tab.Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                )}
                {isActive && !tab.isAction && <span className="ml-2 text-[13px] font-semibold tracking-wide">{tab.name}</span>}
              </button>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              className={`relative flex items-center justify-center overflow-hidden whitespace-nowrap rounded-full transition-all duration-300 ${
                isActive ? "bg-zinc-800 px-4 py-2.5 text-white" : "px-3 py-2.5 text-zinc-400 hover:text-zinc-300"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <tab.Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {isActive && <span className="ml-2 text-[13px] font-semibold tracking-wide">{tab.name}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
