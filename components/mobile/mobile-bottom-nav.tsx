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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 backdrop-blur-2xl md:hidden"
      aria-label="Navegación principal"
    >
      <div className="grid grid-cols-5 px-1" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
                className={`relative flex min-h-[62px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                aria-label={tab.name}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.isAction ? (
                  <span className="grid h-10 w-10 -translate-y-1 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <Plus className="h-5 w-5" strokeWidth={2.4} />
                  </span>
                ) : (
                  <span className={`grid h-7 min-w-10 place-items-center rounded-full px-2 ${isActive ? "bg-primary/10" : ""}`}>
                    <tab.Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                )}
                <span className={tab.isAction ? "-mt-1" : ""}>{tab.name}</span>
              </button>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              className={`relative flex min-h-[62px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={`grid h-7 min-w-10 place-items-center rounded-full px-2 ${isActive ? "bg-primary/10" : ""}`}>
                <tab.Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
              </span>
              <span>{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
