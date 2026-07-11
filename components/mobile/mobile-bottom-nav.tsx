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
    <div
      className="md:hidden fixed z-50 bottom-0 left-0 right-0"
    >
      <div 
        className="absolute inset-0 bg-background border-t border-border/20"
      />

      <div 
        className="relative flex items-center justify-around w-full"
        style={{
          paddingBottom: "16px",
          paddingTop: "12px",
          height: "64px"
        }}
      >
        {tabs.map((tab) => {
          const isActive = optimisticPath === tab.href

          if (tab.isFab) {
            return (
              <div key="fab-container" className="relative flex justify-center items-center px-2">
                <button
                  onClick={() => {
                    hapticFeedback.heavy()
                    onAddPress()
                  }}
                  className="flex items-center justify-center outline-none z-50 transition-transform active:scale-90"
                  aria-label="Añadir transacción"
                >
                  <Plus className="h-[28px] w-[28px] stroke-[2.5] text-foreground" />
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
              className="relative flex flex-col items-center justify-center min-w-[64px]"
              aria-label={tab.name}
              aria-current={isActive ? "page" : undefined}
            >
              <div
                className="transition-transform duration-100 ease-out"
                style={{
                  transform: isActive ? "translateY(-2px) scale(1.15)" : "translateY(0) scale(1)",
                }}
              >
                <tab.icon
                  className="h-[26px] w-[26px] transition-colors duration-200"
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{
                    color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
