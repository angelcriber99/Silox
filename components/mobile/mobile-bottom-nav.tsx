"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Plus, UserCircle, ArrowLeftRight, LineChart } from "lucide-react"
import { hapticFeedback } from "@/lib/utils/haptics"

interface MobileBottomNavProps {
  onAddPress: () => void
}

const tabs = [
  { name: "Inicio",      href: "/",           icon: LayoutDashboard },
  { name: "Análisis",    href: "/analisis",    icon: LineChart },
  { name: "Añadir",      href: "#",            icon: Plus, isFab: true },
  { name: "Movimientos", href: "/movimientos", icon: ArrowLeftRight },
  { name: "Perfil",      href: "/settings",    icon: UserCircle },
]

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [optimisticPath, setOptimisticPath] = useState(pathname)

  useEffect(() => {
    setOptimisticPath(pathname)
  }, [pathname])

  useEffect(() => {
    const prewarm = () => {
      tabs.forEach((tab) => {
        if (!tab.isFab) router.prefetch(tab.href)
      })
      void import("@/components/analysis/comprehensive-analysis")
    }

    const idle = window.requestIdleCallback?.(prewarm, { timeout: 1200 })
    const timer = idle ? null : window.setTimeout(prewarm, 400)

    return () => {
      if (idle) window.cancelIdleCallback(idle)
      if (timer) window.clearTimeout(timer)
    }
  }, [router])

  const navigate = (href: string) => {
    if (href === pathname) return
    setOptimisticPath(href)
    router.prefetch(href)
    window.requestAnimationFrame(() => hapticFeedback.light())
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="absolute inset-0 border-t border-[var(--mobile-line)] bg-[var(--mobile-canvas)]/96 backdrop-blur-xl" />

      <div
        className="relative flex w-full items-end justify-around px-2"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
          paddingTop: "9px",
          minHeight: "74px"
        }}
      >
        {tabs.map((tab) => {
          const isActive = optimisticPath === tab.href

          if (tab.isFab) {
            return (
              <div key="fab-container" className="relative flex items-center justify-center px-2">
                <button
                  onClick={() => {
                    hapticFeedback.heavy()
                    onAddPress()
                  }}
                  className="z-50 flex h-14 w-14 items-center justify-center bg-[var(--mobile-ink)] text-[var(--mobile-canvas)] shadow-[0_12px_26px_rgba(20,20,20,0.24)] outline-none transition-transform active:scale-90 dark:shadow-[0_12px_26px_rgba(0,0,0,0.5)]"
                  aria-label="Añadir transacción"
                >
                  <Plus className="h-7 w-7 stroke-[2.75]" />
                </button>
              </div>
            )
          }

          return (
            <button
              key={tab.name}
              type="button"
              onPointerDown={() => navigate(tab.href)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") navigate(tab.href)
              }}
              className="relative flex min-w-[58px] flex-col items-center justify-center gap-1"
              aria-label={tab.name}
              aria-current={isActive ? "page" : undefined}
            >
              <div
                className="transition-transform duration-100 ease-out"
                style={{
                  transform: isActive ? "translateY(-2px)" : "translateY(0)",
                }}
              >
                <tab.icon
                  className="h-[23px] w-[23px] transition-colors duration-200"
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{
                    color: isActive ? "var(--mobile-ink)" : "var(--mobile-muted)",
                  }}
                />
              </div>
              <span
                className="max-w-[56px] truncate text-[9px] font-black uppercase"
                style={{ color: isActive ? "var(--mobile-ink)" : "var(--mobile-muted)" }}
              >
                {tab.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
