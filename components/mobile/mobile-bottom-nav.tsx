"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  LayoutDashboard,
  Menu,
  Plus,
} from "lucide-react"

import { hapticFeedback } from "@/lib/utils/haptics"

interface MobileBottomNavProps {
  onAddPress: () => void
  onMorePress: () => void
}

const tabs = [
  { name: "Inicio", href: "/", Icon: LayoutDashboard },
  { name: "Análisis", href: "/analisis", Icon: ChartNoAxesCombined },
  { name: "Añadir", href: "#", Icon: Plus, isFab: true },
  { name: "Movimientos", href: "/movimientos", Icon: ArrowLeftRight },
  { name: "Más", href: "#more", Icon: Menu, isMore: true },
] as const

const moreRoutes = ["/historial", "/declarar", "/alertas", "/perfil", "/settings"]

export function MobileBottomNav({ onAddPress, onMorePress }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] xl:hidden"
    >
      <div className="pointer-events-auto mx-auto grid h-[68px] max-w-lg grid-cols-5 items-center rounded-2xl border border-border/80 bg-card/95 px-1.5 shadow-[0_20px_70px_rgba(0,0,0,.48)] backdrop-blur-2xl">
        {tabs.map((tab) => {
          const isActive = tab.href === "/"
            ? pathname === "/"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`)

          if ("isFab" in tab && tab.isFab) {
            return (
              <button
                key={tab.name}
                type="button"
                onClick={() => {
                  hapticFeedback.heavy()
                  onAddPress()
                }}
                className="group relative mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-400 text-slate-950 shadow-lg shadow-sky-500/25 outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Añadir operación o activo"
              >
                <Plus className="size-6" strokeWidth={2.6} />
                <span className="absolute -bottom-3.5 text-[8px] font-black uppercase tracking-wide text-foreground">Añadir</span>
              </button>
            )
          }

          if ("isMore" in tab && tab.isMore) {
            const moreActive = moreRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
            return (
              <button
                key={tab.name}
                type="button"
                onClick={() => {
                  hapticFeedback.light()
                  onMorePress()
                }}
                aria-current={moreActive ? "page" : undefined}
                className="relative flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {moreActive && <span className="absolute inset-1 rounded-xl border border-primary/15 bg-primary/10" />}
                <Menu className={`relative size-5 ${moreActive ? "text-primary" : "text-muted-foreground"}`} strokeWidth={moreActive ? 2.3 : 1.9} />
                <span className={`relative text-[9px] font-bold ${moreActive ? "text-foreground" : "text-muted-foreground"}`}>Más</span>
              </button>
            )
          }

          const { Icon } = tab
          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              aria-current={isActive ? "page" : undefined}
              className="relative flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-navigation-active"
                  className="absolute inset-1 rounded-xl border border-sky-400/15 bg-sky-400/10"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                />
              )}
              <Icon className={`relative size-5 ${isActive ? "text-sky-400" : "text-muted-foreground"}`} strokeWidth={isActive ? 2.3 : 1.9} />
              <span className={`relative max-w-full truncate text-[9px] font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
